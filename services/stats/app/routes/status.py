from fastapi import APIRouter

router = APIRouter()


@router.get("/api/stats/status")
def status():
    return {
        "data": {"status": "ok"},
        "meta": {"atualizado_em": None},
    }
