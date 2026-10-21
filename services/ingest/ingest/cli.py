"""Roda o fluxo do serviço para um objeto do bucket, sem o Eventarc.

    uv run python -m ingest.cli gs://datropa-raw-matches/partidas/<pasta>/<arquivo>.json

Por padrão é só leitura: lê o objeto, monta a linha, confere o schema da
tabela, faz dry run da consulta de duplicado (mostra os bytes) e roda essa
consulta (SELECT). Não carrega nada.

`--carregar` faz o load de verdade, igual ao serviço. Só com o OK do Guilherme.
"""

from __future__ import annotations

import argparse
import json

from . import carga, config


def main(argv=None):
    p = argparse.ArgumentParser(prog="python -m ingest.cli")
    p.add_argument("objeto", help="gs://bucket/partidas/...json")
    p.add_argument("--carregar", action="store_true", help="carrega no bronze (sem isso, só leitura)")
    args = p.parse_args(argv)

    if not args.objeto.startswith("gs://"):
        p.error("use gs://bucket/caminho")
    bucket, _, nome = args.objeto.removeprefix("gs://").partition("/")
    ev = carga.Evento(bucket=bucket, nome=nome)
    fontes = carga.Gcp()

    print(f"tabela: {config.tabela()}")
    if nome.startswith(config.PREFIXO) and nome.lower().endswith(".json"):
        arquivo, pasta = carga.arquivo_e_pasta(nome[len(config.PREFIXO):])
        conteudo = fontes.ler_objeto(ev)
        linha = carga.ler_partida(conteudo, arquivo, pasta)
        match_id = (linha.get("matchInfo") or {}).get("matchId")
        print(f"objeto: {len(conteudo)} bytes, rounds={len(linha.get('roundResults') or [])}, "
              f"players={len(linha.get('players') or [])}, matchId={match_id}")
        print(f"_pasta={pasta!r} _arquivo={arquivo!r}")
        print(f"dry run da checagem de duplicado: {fontes.bytes_checagem(arquivo, pasta, match_id)} bytes")

    res = carga.processar(ev, fontes, carregar=args.carregar)
    print(json.dumps({"status": res.status, "motivo": res.motivo, **res.detalhes}, ensure_ascii=False))


if __name__ == "__main__":
    main()
