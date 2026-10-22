'/api/stats/times/{time_id}' """Testes HTTP sem credenciais e sem executar consultas no BigQuery."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore, Event
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from google.cloud.bigquery.table import Row

from app import cache, database
from app.main import app


def row(**values):
    return Row(tuple(values.values()), {key: i for i, key in enumerate(values)})


class ApiTests(unittest.TestCase):
    def setUp(self):
        cache._cache.clear()
        self.semaphore = patch.object(database, "CONSULTAS_SIMULTANEAS", BoundedSemaphore(4))
        self.semaphore.start()
        self.addCleanup(self.semaphore.stop)
        self.client_patch = patch.object(database.bigquery, "Client")
        self.client_factory = self.client_patch.start()
        self.addCleanup(self.client_patch.stop)
        self.bq = self.client_factory.return_value.__enter__.return_value
        self.http = TestClient(app)

    def query_results(self, *results):
        jobs = []
        for result in results:
            job = MagicMock()
            job.result.return_value = result
            jobs.append(job)
        self.bq.query.side_effect = jobs

    def assert_slots_available(self):
        acquired = []
        try:
            for _ in range(4):
                available = database.CONSULTAS_SIMULTANEAS.acquire(blocking=False)
                self.assertTrue(available)
                acquired.append(available)
            self.assertFalse(database.CONSULTAS_SIMULTANEAS.acquire(blocking=False))
        finally:
            for _ in acquired:
                database.CONSULTAS_SIMULTANEAS.release()

    def test_status_and_routes(self):
        self.assertEqual(self.http.get('/api/stats/status').json(), {
            'data': {'status': 'ok'}, 'meta': {'atualizado_em': None},
        })
        paths = set(app.openapi()['paths'])
        self.assertEqual(
            paths,
            {
                "/api/stats/status",
                "/api/stats/ranking",
                "/api/stats/jogadores/{jogador_id}",
                "/api/stats/times",
                "/api/stats/times/{time_id}",
                "/api/stats/times/{time_id}/economia",
                "/api/stats/times/{time_id}/pos-plant-retake",
                "/api/stats/partidas",
                "/api/stats/partidas/{partida_id}",
                "/api/stats/composicoes",
            },
        )
        self.client_factory.assert_not_called()

    def test_invalid_arguments_do_not_query(self):
        for path in [
            '/ranking?page=0', '/ranking?page_size=101', '/ranking?ordem=sql',
            '/ranking?page=1&page=2', '/ranking?inesperado=1',
            '/times?data_inicio=2026-02-30',
            '/jogadores/id?data_inicio=2026-06-22&data_fim=2026-06-20',
            '/times?mapa_id=%20ascent', '/jogadores/id?data_inicio=2026-6-01',
        ]:
            with self.subTest(path=path):
                response = self.http.get('/api/stats' + path)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['error']['code'], 'INVALID_ARGUMENT')
        self.client_factory.assert_not_called()

    def test_ranking_pagination_and_cache(self):
        player = row(jogador_id='p1', nome='Teste', kills=20, kd=None)
        self.query_results([player], [row(total=411)])
        response = self.http.get('/api/stats/ranking?page=2&page_size=3')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'data': [{'jogador_id': 'p1', 'nome': 'Teste', 'kills': 20, 'kd': None}],
            'pagination': {'page': 2, 'page_size': 3, 'total': 411},
            'meta': {'atualizado_em': None},
        })
        again = self.http.get('/api/stats/ranking?page=2&page_size=3')
        self.assertEqual(again.json(), response.json())
        self.assertEqual(self.bq.query.call_count, 2)
        params = self.bq.query.call_args_list[0].kwargs['job_config'].query_parameters
        self.assertEqual({p.name: p.value for p in params}, {'limite': 3, 'deslocamento': 3})
        for call in self.bq.query.call_args_list:
            self.assertEqual(call.kwargs['job_config'].maximum_bytes_billed, 1073741824)
        self.assert_slots_available()

    def test_filtered_ranking_orders_and_separate_cache_keys(self):
        for order, column in [('kills_desc', 'kills'), ('kd_desc', 'kd'), ('adr_desc', 'adr')]:
            self.query_results([row(jogadores=[], total=293)])
            response = self.http.get(f'/api/stats/ranking?mapa_id=ascent&ordem={order}')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['pagination']['total'], 293)
            sql = self.bq.query.call_args.args[0]
            self.assertIn(f'ORDER BY {column} DESC NULLS LAST, jogador_id', sql)
        self.assertEqual(self.bq.query.call_count, 3)

    def test_jogador_nested_serialization_and_dates(self):
        player = row(id='p1', nome='Teste', times=[{'id': 't1', 'nome': 'Time'}],
                     resumo={'partidas': 2, 'kd': None}, agentes=[], mapas=[])
        self.query_results([player])
        response = self.http.get('/api/stats/jogadores/p1?data_inicio=2026-06-20&data_fim=2026-06-21')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['resumo'], {'partidas': 2, 'kd': None})
        params = self.bq.query.call_args.kwargs['job_config'].query_parameters
        self.assertTrue(all(p.type_ == 'STRING' for p in params))
        self.assertEqual({p.name: p.value for p in params}['data_inicio'], '2026-06-20')
        self.assert_slots_available()

    def test_jogador_not_found_releases_slot(self):
        self.query_results([])
        response = self.http.get('/api/stats/jogadores/inexistente')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error']['code'], 'NOT_FOUND')
        self.assert_slots_available()

    def test_jogador_empty_slice_and_cache(self):
        player = row(id='p1', nome='Teste', times=[], resumo={'partidas': 0, 'kd': None}, agentes=[], mapas=[])
        self.query_results([player])
        path = '/api/stats/jogadores/p1?data_inicio=2020-01-01'
        response = self.http.get(path)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['resumo']['partidas'], 0)
        self.assertEqual(self.http.get(path).json(), response.json())
        self.assertEqual(self.bq.query.call_count, 1)
        self.assert_slots_available()

    def test_times_pagination_and_filters(self):
        self.query_results([row(times=[row(id='t1', nome='Time', partidas=9)], total=52)])
        response = self.http.get('/api/stats/times?mapa_id=ascent&page_size=3')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['pagination'], {'page': 1, 'page_size': 3, 'total': 52})
        self.assertEqual(self.http.get('/api/stats/times?mapa_id=ascent&page_size=3').json(), response.json())
        self.assertEqual(self.bq.query.call_count, 1)
        self.assert_slots_available()

    def test_busy_server_does_not_open_client(self):
        for _ in range(4):
            database.CONSULTAS_SIMULTANEAS.acquire()
        try:
            for path in ['/ranking', '/jogadores/p1', '/times']:
                response = self.http.get('/api/stats' + path)
                self.assertEqual(response.status_code, 503)
                self.assertIn('Servidor ocupado', response.json()['error']['message'])
            self.client_factory.assert_not_called()
        finally:
            for _ in range(4):
                database.CONSULTAS_SIMULTANEAS.release()

    def test_client_creation_failure_releases_slots(self):
        self.client_factory.side_effect = RuntimeError('Falha simulada')
        for path in ['/ranking', '/jogadores/p1', '/times']:
            with self.assertLogs(level='ERROR'):
                response = self.http.get('/api/stats' + path)
            self.assertEqual(response.status_code, 503)
            self.assert_slots_available()
        self.assertFalse(cache._cache)

    def test_query_failure_releases_slots(self):
        self.bq.query.side_effect = RuntimeError('Falha simulada')
        for path in ['/ranking', '/jogadores/p1', '/times']:
            with self.assertLogs(level='ERROR'):
                response = self.http.get('/api/stats' + path)
            self.assertEqual(response.status_code, 503)
            self.assert_slots_available()

    def test_identical_concurrent_requests_reuse_result(self):
        entered, release = Event(), Event()
        def query(*args, **kwargs):
            entered.set()
            if not release.wait(5):
                raise RuntimeError('Teste excedeu o tempo')
            job = MagicMock()
            job.result.return_value = [row(times=[], total=0)]
            return job
        self.bq.query.side_effect = query
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(self.http.get, '/api/stats/times?mapa_id=ascent') for _ in range(3)]
            try:
                self.assertTrue(entered.wait(5))
            finally:
                release.set()
            responses = [future.result(timeout=10) for future in futures]
        self.assertTrue(all(response.status_code == 200 for response in responses))
        self.assertEqual(self.bq.query.call_count, 1)
        self.assert_slots_available()


if __name__ == '__main__':
    unittest.main()
