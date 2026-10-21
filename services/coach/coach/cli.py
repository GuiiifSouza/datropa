"""CLI local do coach.

    uv run python -m coach.cli                      # conversa interativa
    uv run python -m coach.cli "como joga o time X" # pergunta avulsa
    uv run python -m coach.cli --dry-run            # bytes de cada consulta das tools
    uv run python -m coach.cli --tool stats_time '{"time_id": "..."}'  # tool direto, sem Gemini
"""

from __future__ import annotations

import argparse
import json
import logging
import sys

from . import config


def _mostrar(resp, rastro: bool) -> None:
    if rastro:
        for c in resp.chamadas:
            print(f"  [tool] {c.nome}({json.dumps(c.argumentos, ensure_ascii=False)})"
                  + (f" -> erro: {c.resultado['erro']}" if "erro" in c.resultado else ""))
    print(resp.texto)


def _dry_run() -> int:
    from .bq import CONSULTAS
    from . import tools  # noqa: F401  registra as consultas

    print(f"dry run em {config.PROJETO}.{config.DATASET} (prefixo={config.GOLD_PREFIXO!r}), "
          f"maximum_bytes_billed={config.MAX_BYTES_BILLED}")
    total = 0
    for nome, consulta in CONSULTAS.items():
        b = consulta.dry_run()
        total += b
        print(f"  {nome:32s} {b:>12,d} bytes  ({b / 1024**2:.2f} MiB)")
    print(f"  {'total':32s} {total:>12,d} bytes")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="coach")
    p.add_argument("pergunta", nargs="*", help="pergunta avulsa; sem ela abre a conversa")
    p.add_argument("--dry-run", action="store_true", help="mostra os bytes de cada consulta")
    p.add_argument("--tool", help="roda uma tool direto, sem o Gemini; argumentos em JSON")
    p.add_argument("--sem-rastro", action="store_true", help="não mostra as tools chamadas")
    p.add_argument("-v", "--verbose", action="store_true")
    a = p.parse_args(argv)
    logging.basicConfig(level=logging.INFO if a.verbose else logging.WARNING)

    if a.dry_run:
        return _dry_run()

    if a.tool:
        from .tools import REGISTRO
        args = json.loads(" ".join(a.pergunta) or "{}")
        print(json.dumps(REGISTRO[a.tool].executar(args), ensure_ascii=False, indent=2))
        return 0

    from .agente import Conversa

    conversa = Conversa()
    if a.pergunta:
        _mostrar(conversa.perguntar(" ".join(a.pergunta)), not a.sem_rastro)
        return 0

    print(f"Coach Da Tropa ({config.MODELO}). Ctrl+D para sair.")
    while True:
        try:
            pergunta = input("\nvocê> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if pergunta:
            _mostrar(conversa.perguntar(pergunta), not a.sem_rastro)


if __name__ == "__main__":
    sys.exit(main())
