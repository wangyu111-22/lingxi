"""
灵犀 LingXi — 华为盘古 Embedding 服务

用于 RAG 向量检索，替代 DashScope Embedding。
基于 Pangu-EmbeddingRank-zh-2.0.3 模型。
"""
from __future__ import annotations

import time
from typing import List, Optional

import httpx
from loguru import logger

from app.config import settings


class HuaweiEmbeddings:
    """华为盘古 Embedding — 兼容 LangChain Embeddings 接口"""

    def __init__(
        self,
        api_key: str = "",
        project_id: str = "",
        deployment_id: str = "",
        iam_endpoint: str = "",
        ak: str = "",
        sk: str = "",
    ):
        self.api_key = api_key or settings.huawei_api_key
        self.project_id = project_id or settings.huawei_project_id
        self.deployment_id = deployment_id or settings.huawei_embedding_deployment_id
        self.iam_endpoint = iam_endpoint or settings.huawei_iam_endpoint
        self.ak = ak or settings.huawei_ak
        self.sk = sk or settings.huawei_sk
        self._cached_token: str | None = None
        self._token_expiry: float = 0.0

    async def _get_token(self) -> str:
        """获取华为云 IAM Token（带缓存）"""
        now = time.time()
        if self._cached_token and (now < self._token_expiry - 3600):
            return self._cached_token

        from app.services.llm_provider import get_iam_token
        token = get_iam_token()
        if not token and self.api_key:
            token = self.api_key
        self._cached_token = token
        self._token_expiry = now + 86400
        return token

    def _build_url(self) -> str:
        """构建完整的 Embedding API URL"""
        base = settings.huawei_base_url.rstrip("/")
        pid = self.project_id
        did = self.deployment_id
        return f"{base}/v1/{pid}/infer-api/proxy/service/{did}/app/search/v1/vector/query"

    def embed_query(self, text: str) -> List[float]:
        """嵌入单条文本 — 同步接口（适配 LangChain）"""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import concurrent.futures
                future = concurrent.futures.Future()

                async def _run():
                    try:
                        result = await self._embed_async(text)
                        future.set_result(result)
                    except Exception as e:
                        future.set_exception(e)

                asyncio.ensure_future(_run())
                return future.result(timeout=30.0)
            return loop.run_until_complete(self._embed_async(text))
        except RuntimeError:
            return asyncio.run(self._embed_async(text))

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """批量嵌入文本"""
        return [self.embed_query(t) for t in texts]

    async def _embed_async(self, text: str) -> List[float]:
        """异步调用华为 Embedding API"""
        token = await self._get_token()
        if not token:
            raise RuntimeError("华为 Embedding: 无有效 Token")

        url = self._build_url()
        headers = {
            "Content-Type": "application/json",
        }
        # 优先用 API Key，否则用 Token
        if self.api_key:
            headers["X-Apig-AppCode"] = self.api_key
        else:
            headers["X-Auth-Token"] = token

        body = {"query": text}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=body, headers=headers)

        if resp.status_code != 200:
            raise RuntimeError(f"华为 Embedding 请求失败: {resp.status_code} {resp.text[:300]}")

        data = resp.json()
        # 根据盘古 Embedding 返回格式提取向量
        vectors = data.get("vectors") or data.get("result", {}).get("vectors") or []
        if isinstance(vectors, list) and len(vectors) > 0:
            v = vectors[0]
            if isinstance(v, dict):
                v = v.get("vector") or v.get("embedding") or []
            if isinstance(v, list) and len(v) > 0 and isinstance(v[0], (int, float)):
                return [float(x) for x in v]
        # 尝试直接取值
        if isinstance(data, list) and len(data) > 0:
            return [float(x) for x in data]
        raise RuntimeError(f"华为 Embedding 返回格式异常: {str(data)[:200]}")
