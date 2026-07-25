"""Side-effect-free service configuration status."""

from fastapi import APIRouter

from app.config import settings


router = APIRouter(prefix="/system", tags=["system"])


def _configured(value: str | None) -> bool:
    return bool(value and value.strip())


def build_service_status() -> dict:
    """Report provider readiness without exposing credentials or calling providers."""
    huawei_auth = _configured(settings.huawei_api_key) or (
        _configured(settings.huawei_ak) and _configured(settings.huawei_sk)
    )
    huawei_embedding = (
        huawei_auth
        and _configured(settings.huawei_project_id)
        and _configured(settings.huawei_embedding_deployment_id)
    )
    dashscope = _configured(settings.openai_api_key)

    if settings.embedding_model == "local":
        selected_embedding = "chroma-local"
    elif huawei_embedding:
        selected_embedding = "huawei"
    elif dashscope:
        selected_embedding = "dashscope-or-openai-compatible"
    else:
        selected_embedding = "chroma-local"

    return {
        "status": "ok",
        "services": {
            "embedding": {
                "selected": selected_embedding,
                "fallback": "chroma-local",
                "configured": {
                    "huawei": huawei_embedding,
                    "dashscope_or_openai": dashscope,
                    "local": True,
                },
            },
            "speech": {
                "huawei": huawei_auth and _configured(settings.huawei_project_id),
                "dashscope_asr": dashscope,
                "edge_tts_fallback": True,
            },
            "llm": {
                "selected": settings.llm_provider,
                "configured": {
                    "huawei": _configured(settings.huawei_api_key),
                    "dashscope": dashscope,
                    "spark": _configured(settings.spark_api_key),
                },
            },
        },
    }


@router.get("/services")
async def service_status():
    return build_service_status()
