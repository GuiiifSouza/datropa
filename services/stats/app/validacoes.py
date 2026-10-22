import re
from datetime import date

from app.erros import ApiError


def validar_parametros(request, permitidos):
    for campo in request.query_params:
        if campo not in permitidos:
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Parâmetro não suportado: {campo}.",
                campo,
            )

        if len(request.query_params.getlist(campo)) > 1:
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Parâmetro repetido: {campo}.",
                campo,
            )


def validar_identificadores(identificadores):
    for campo, valor in identificadores.items():
        if valor is not None and (
            not valor.strip()
            or valor != valor.strip()
            or len(valor) > 256
        ):
            raise ApiError(
                400,
                "INVALID_ARGUMENT",
                f"Identificador inválido para {campo}.",
                campo,
            )


def validar_data(valor, campo):
    if valor is None:
        return None

    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", valor):
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            f"{campo} deve usar YYYY-MM-DD.",
            campo,
        )

    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            f"Data inválida para {campo}.",
            campo,
        )


def validar_periodo(data_inicio, data_fim):
    inicio = validar_data(data_inicio, "data_inicio")
    fim = validar_data(data_fim, "data_fim")

    if inicio is not None and fim is not None and inicio > fim:
        raise ApiError(
            400,
            "INVALID_ARGUMENT",
            "data_inicio não pode ser posterior a data_fim.",
            "data_inicio",
        )

    return inicio, fim
