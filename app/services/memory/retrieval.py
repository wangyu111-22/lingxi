"""
LingXiMind 记忆系统 — 上下文感知检索

不同于简单语义搜索，本模块实现:
1. 上下文关联增强: 当前工作记忆中的节点会提升关联记忆的排名
2. 遗忘感知排序: 近期强化过的记忆获得新鲜度加分
3. 图拓扑扩散: 从当前上下文沿图谱扩散发现相关记忆
4. 多源证据加权: 证据链越完整，置信度越高
"""
from __future__ import annotations

import asyncio
import math
from datetime import datetime, timezone
from typing import Optional

from loguru import logger

from app.config import settings
from app.services.memory.forgetting import memory_strength
from app.services.memory.models import (
    MemoryType,
    MemoryLayer,
    MemoryEvidence,
    MemoryRetrievalResult,
    MemorySearchResponse,
)


class MemoryRetriever:
    """
    上下文感知记忆检索器

    多阶段排序策略:
    1. 语义匹配 (向量/关键词) → 初始候选集
    2. 上下文扩散 → 图邻居扩充候选集
    3. 遗忘感知重排 → 综合强度+新鲜度+关联度+证据质量的分数
    """

    def __init__(self, memory_store: "MemoryStore"):
        from app.services.memory.store import MemoryStore
        self.store: MemoryStore = memory_store

    async def search(
        self,
        query: str,
        top_k: int = 10,
        context_node_ids: Optional[list[int]] = None,
        min_strength: float = 0.2,
        include_evidences: bool = True,
    ) -> MemorySearchResponse:
        """
        上下文感知记忆搜索

        Args:
            query: 搜索查询
            top_k: 返回结果数
            context_node_ids: 当前上下文(工作记忆)中的节点ID
            min_strength: 最低记忆强度过滤
            include_evidences: 是否包含证据详情
        """
        import time
        t0 = time.time()

        context_node_ids = context_node_ids or []

        # Phase 1: 关键词候选召回
        candidates = self._keyword_recall(query, top_k * 3, context_node_ids)

        # Phase 2: 上下文扩散
        expanded = self._context_expand(candidates, context_node_ids)

        # Phase 3: 遗忘感知重排序
        now = datetime.now(timezone.utc)
        scored = []
        for node_id in set(candidates + expanded):
            node_data = self.store.get_node(node_id)
            if not node_data:
                continue

            score = self._compute_retrieval_score(
                node_data, query, context_node_ids, now
            )

            if score["final_score"] < 0.2:
                continue

            strength = score["current_strength"]
            if strength < min_strength:
                continue

            evidences = []
            if include_evidences:
                evidence_json = node_data.get("evidence_json", [])
                for ev in evidence_json[:5]:
                    evidences.append(MemoryEvidence(
                        source_type=ev.get("source_type", "bilibili"),
                        source_id=ev.get("source_id", ev.get("bvid", "")),
                        source_title=ev.get("source_title", ""),
                        segment_id=ev.get("segment_id"),
                        start_time=ev.get("start_time"),
                        end_time=ev.get("end_time"),
                        text_snippet=ev.get("text_snippet", ev.get("raw_text", ""))[:300],
                        confidence=ev.get("confidence", 0.5),
                    ))

            scored.append(MemoryRetrievalResult(
                node_id=node_id,
                name=node_data.get("name", ""),
                content=node_data.get("content", node_data.get("definition", "")),
                memory_type=MemoryType(node_data.get("memory_type", "semantic")),
                memory_layer=MemoryLayer(node_data.get("memory_layer", "short_term")),
                strength=round(strength, 3),
                relevance_score=round(score["relevance_score"], 3),
                context_boost=round(score["context_boost"], 3),
                freshness_boost=round(score["freshness_boost"], 3),
                evidence_count=len(evidences),
                evidences=evidences,
            ))

        # 排序: 综合分数降序
        scored.sort(key=lambda x: (
            x.context_boost + x.relevance_score * 0.6 + x.freshness_boost * 0.4
        ), reverse=True)

        elapsed = (time.time() - t0) * 1000

        return MemorySearchResponse(
            query=query,
            results=scored[:top_k],
            total_found=len(scored),
            retrieval_time_ms=round(elapsed, 2),
        )

    def _keyword_recall(
        self, query: str, limit: int, context_ids: list[int]
    ) -> list[int]:
        """关键词快速召回"""
        query_lower = query.lower()
        query_tokens = set(query_lower.split())

        scored = []
        for nid, attrs in self.store.graph.nodes(data=True):
            name = (attrs.get("name") or "").lower()
            content = (attrs.get("content", attrs.get("definition", "")) or "").lower()
            normalized = (attrs.get("normalized_name") or "").lower()

            combined = f"{name} {normalized} {content}"

            # Token 命中计数
            hits = sum(1 for t in query_tokens if t in combined)
            # 名称完全命中
            exact = 2.0 if query_lower in name else 0.0

            score = hits * 0.35 + exact
            if score > 0:
                scored.append((nid, score))

        scored.sort(key=lambda x: -x[1])
        return [nid for nid, _ in scored[:limit]]

    def _context_expand(
        self, candidates: list[int], context_ids: list[int], max_expand: int = 15
    ) -> list[int]:
        """从上下文节点沿图谱扩散，发现间接相关的记忆"""
        if not context_ids:
            return []

        expanded = set()
        for ctx_id in context_ids:
            neighbors = self.store.get_neighbors(ctx_id, direction="both")
            for nb in neighbors[:5]:  # 每节点最多扩散5个邻居
                nid = nb["id"]
                if nid not in candidates and nid not in expanded:
                    expanded.add(nid)
                if len(expanded) >= max_expand:
                    break
            if len(expanded) >= max_expand:
                break

        return list(expanded)

    def _compute_retrieval_score(
        self,
        node_data: dict,
        query: str,
        context_ids: list[int],
        now: datetime,
    ) -> dict:
        """综合评分计算"""
        base_strength = node_data.get("base_strength", 0.5)
        stability = node_data.get("stability", 1.0)
        last_recall = node_data.get("last_recall")
        created_at = node_data.get("created_at")
        recall_count = node_data.get("recall_count", 0)

        # 当前强度
        current_strength = memory_strength(
            base_strength, stability, last_recall, created_at, now
        )

        # 语义相关性
        query_lower = query.lower()
        name = (node_data.get("name") or "").lower()
        content = (node_data.get("content", node_data.get("definition", "")) or "").lower()
        combined = f"{name} {content}"

        query_tokens = set(query_lower.split())
        token_hits = sum(1 for t in query_tokens if t in combined)
        token_ratio = token_hits / max(len(query_tokens), 1)
        exact_bonus = 0.35 if query_lower in name else (0.15 if query_lower in content else 0.0)
        relevance_score = min(1.0, token_ratio * 0.55 + exact_bonus + 0.1)

        # 上下文关联加分
        context_boost = 0.0
        node_id = node_data.get("id")
        if node_id and context_ids:
            for ctx_id in context_ids:
                # 直接邻居
                neighbors = self.store.get_neighbors(ctx_id, direction="both")
                neighbor_ids = {n["id"] for n in neighbors}
                if node_id in neighbor_ids:
                    context_boost = max(context_boost, 0.3)
                # 最短路径 (2跳以内)
                path = self.store.find_shortest_path(ctx_id, node_id)
                if 2 <= len(path) <= 3:
                    context_boost = max(context_boost, 0.15)

        # 新鲜度加分 (近期检索过的记忆)
        freshness_boost = 0.0
        if last_recall:
            if last_recall.tzinfo is None:
                from datetime import timezone as tz
                last_recall = last_recall.replace(tzinfo=tz.utc)
            hours_since = (now - last_recall).total_seconds() / 3600
            if hours_since < 1:
                freshness_boost = 0.25
            elif hours_since < 6:
                freshness_boost = 0.15
            elif hours_since < 24:
                freshness_boost = 0.08

        # 证据强度加分
        evidence_count = len(node_data.get("evidence_json", []))
        evidence_boost = min(0.2, evidence_count * 0.04)

        # 综合分数
        final_score = (
            relevance_score * 0.40 +
            context_boost * 0.25 +
            freshness_boost * 0.15 +
            evidence_boost * 0.10 +
            current_strength * 0.10
        )

        return {
            "final_score": round(final_score, 4),
            "relevance_score": round(relevance_score, 3),
            "context_boost": round(context_boost, 3),
            "freshness_boost": round(freshness_boost, 3),
            "evidence_boost": round(evidence_boost, 3),
            "current_strength": round(current_strength, 3),
        }
