from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status, code, message, field=None):
        self.status = status
        self.code = code
        self.message = message
        self.field = field


async def tratar_erro(request, exc):
    return JSONResponse(
        status_code=exc.status,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": (
                    {"field": exc.field} if exc.field else {}
                ),
            }
        },
    )


async def tratar_parametro_invalido(request, exc):
    erro = exc.errors()[0]
    campo = str(erro["loc"][-1])

    return JSONResponse(
        status_code=400,
        content={
            "error": {
                "code": "INVALID_ARGUMENT",
                "message": f"Valor inválido para {campo}.",
                "details": {"field": campo},
            }
        },
    )
