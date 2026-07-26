"""
灵犀 LingXi — 统一 LLM Provider 调度层

支持 华为盘古大模型 (默认) / DashScope (阿里云通义千问) / 讯飞星火 Spark，
通过 LLM_PROVIDER 环境变量切换。

使用方式:
    from app.services.llm_provider import get_llm_config, create_async_client, create_client
    api_key, base_url, model = get_llm_config()
    client = create_async_client()
"""

from __future__ import annotations

from openai import AsyncOpenAI, OpenAI

from app.config import settings


def get_llm_config() -> tuple[str, str, str]:
    """
    根据 LLM_PROVIDER 返回 (api_key, base_url, model)。

    返回:
        (api_key, base_url, model) 三元组
    """
    provider = settings.llm_provider.lower()

    if provider == "huawei":
        # 华为盘古大模型 — OpenAI 兼容 V2 接口
        api_key = settings.huawei_api_key or settings.openai_api_key
        base_url = settings.huawei_base_url
        model = settings.huawei_model
    elif provider == "spark":
        api_key = settings.spark_api_key or settings.openai_api_key
        base_url = settings.spark_base_url
        model = settings.spark_model
    else:
        # 默认 dashscope / openai 兼容
        api_key = settings.openai_api_key
        base_url = settings.openai_base_url
        model = settings.llm_model

    return api_key, base_url, model


def create_async_client(timeout: float = 60.0) -> AsyncOpenAI:
    """创建异步 OpenAI 兼容客户端（用于 extractor / agent / compiler / learning_path）。"""
    api_key, base_url, _model = get_llm_config()
    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)


def create_client(timeout: float = 60.0) -> OpenAI:
    """创建同步 OpenAI 兼容客户端（用于 chat.py 非流式调用）。"""
    api_key, base_url, _model = get_llm_config()
    return OpenAI(api_key=api_key, base_url=base_url, timeout=timeout)


def get_model_name() -> str:
    """获取当前 Provider 的模型名。"""
    _api_key, _base_url, model = get_llm_config()
    return model


def get_provider_display_name() -> str:
    """获取当前 Provider 显示名称（展示给用户）。"""
    prov = settings.llm_provider.lower()
    return {
        "huawei": "华为盘古大模型",
        "spark": "讯飞星火大模型",
        "dashscope": "阿里云通义千问",
    }.get(prov, prov)


def get_provider_name() -> str:
    """获取当前 Provider 名称（用于日志/调试）。"""
    return settings.llm_provider.lower()


def get_provider_status() -> dict:
    """返回当前 LLM Provider 的真实配置状态，供健康检查和前端展示使用。"""
    api_key, base_url, model = get_llm_config()
    provider = get_provider_name()
    return {
        "provider": provider,
        "display_name": get_provider_display_name(),
        "configured": bool(api_key and base_url and model),
        "base_url": base_url,
        "model": model,
    }


def get_iam_token() -> str:
    """
    获取华为云 IAM Token（用于 ASR / TTS / Embedding）。

    需要配置 HUAWEI_AK, HUAWEI_SK, HUAWEI_IAM_ENDPOINT, HUAWEI_PROJECT_ID。
    Token 有效期 24 小时，建议生产环境加缓存。

    Returns:
        X-Auth-Token 字符串
    """
    import requests
    import json

    ak = settings.huawei_ak
    sk = settings.huawei_sk
    if not ak or not sk:
        # 回退到 API Key 模式（部分服务支持）
        return ""

    iam_endpoint = settings.huawei_iam_endpoint.rstrip("/")
    project_id = settings.huawei_project_id
    url = f"{iam_endpoint}/v3/auth/tokens"

    body = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {
                    "user": {
                        "domain": {"name": ak},
                        "name": ak,
                        "password": sk,
                    }
                }
            },
            "scope": {
                "project": {"id": project_id}
            }
        }
    }

    try:
        resp = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=10)
        if resp.status_code == 201:
            token = resp.headers.get("X-Subject-Token", "")
            return token
        else:
            from loguru import logger
            logger.warning(f"华为云 IAM Token 获取失败: {resp.status_code} {resp.text[:200]}")
            return ""
    except Exception as e:
        from loguru import logger
        logger.warning(f"华为云 IAM Token 获取异常: {e}")
        return ""
