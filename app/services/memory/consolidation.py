"""
LingXiMind 记忆系统 — 记忆合并与冲突检测

核心功能:
1. 语义去重: embedding 相似度 + LLM 确认，检测同义不同名的知识
2. 记忆合并: 合并重复节点，保留最强证据
3. 冲突检测: 新知识与已有记忆的矛盾识别
4. 质量治理: 低置信度记忆自动降级或标记
"""
from __future__ import annotations

import asyncio
import json
import math
import re
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
from openai import AsyncOpenAI
from sqlalchemy import select, delete, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.memory.models import (
    MemoryType,
    MemoryLayer,
    MemoryEvidence,
    ConflictReport,
    MemoryConsolidationResult,
)


# ==================== 文本归一化 ====================

def _normalize(text: str) -> str:
    """归一化文本"""
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[（(].*?[）)]", "", text).strip()
    text = re.sub(r"[^\w一-鿿\s]", "", text)
    return text


def _jaccard_similarity(text1: str, text2: str) -> float:
    """Jaccard 字符级别相似度 (快速预筛)"""
    set1 = set(text1)
    set2 = set(text2)
    if not set1 or not set2:
        return 0.0
    return len(set1 & set2) / len(set1 | set2)


# ==================== LLM 确认 ====================

SEMANTIC_MERGE_PROMPT = """你是知识质量审核专家。判断以下两个知识节点是否表示同一知识。

节点A:
- 名称: {name_a}
- 类型: {type_a}
- 内容: {content_a}

节点B:
- 名称: {name_b}
- 类型: {type_b}
- 内容: {content_b}

请输出JSON:
{{
  "is_same": true/false,
  "confidence": 0.0-1.0,
  "merged_name": "合并后的最佳名称",
  "reason": "判断理由"
}}

规则:
1. 同义不同名视为相同 (如 "梯度下降" vs "Gradient Descent")
2. 上下位关系不算相同 (如 "机器学习" vs "监督学习")
3. confidence < 0.6 时 is_same 应为 false"""

CONFLICT_DETECTION_PROMPT = """你是知识审查专家。检测新知识与已有知识之间是否存在矛盾。

已有知识:
- 名称: {existing_name}
- 内容: {existing_content}

新知识:
- 名称: {new_name}
- 内容: {new_content}

请输出JSON:
{{
  "has_conflict": true/false,
  "conflict_type": "contradiction|refinement|perspective_diff",
  "severity": 0.0-1.0,
  "explanation": "冲突说明",
  "resolution": "如何解决此冲突的建议"
}}

规则:
1. 直接矛盾 (contradiction): 新旧知识在事实层面互斥，severity >= 0.7
2. 细化修正 (refinement): 新知识完善或修正了旧知识，severity 0.3-0.6
3. 视角差异 (perspective_diff): 不同角度或场景下的合理差异，severity < 0.3"""


# ==================== 核心合并器 ====================

class MemoryConsolidator:
    """
    记忆合并引擎

    流程:
    1. 文本归一化 + Jaccard 快速预筛
    2. Embedding 语义相似度 (如果可用)
    3. LLM 确认是否为同一知识
    4. 合并证据列表、更新强度
    5. 冲突检测
    """

    def __init__(self, memory_store: "MemoryStore"):
        from app.services.memory.store import MemoryStore
        from app.services.llm_provider import get_llm_config, get_model_name
        self.store: MemoryStore = memory_store
        self.client: Optional[AsyncOpenAI] = None
        api_key, base_url, model = get_llm_config()
        self._model_name = model
        if api_key:
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
            )

    def fast_similarity(self, node_a: dict, node_b: dict) -> float:
        """快速文本相似度 (不依赖LLM)"""
        text_a = _normalize(
            f"{node_a.get('name', '')} {node_a.get('content', node_a.get('definition', ''))}"
        )
        text_b = _normalize(
            f"{node_b.get('name', '')} {node_b.get('content', node_b.get('definition', ''))}"
        )
        return _jaccard_similarity(text_a, text_b)

    async def check_semantic_merge(
        self, node_a: dict, node_b: dict
    ) -> Optional[dict]:
        """检查两个节点是否应合并 (LLM确认)"""
        jaccard = self.fast_similarity(node_a, node_b)

        # Jaccard < 0.15 几乎不可能同义
        if jaccard < 0.15:
            return None

        # Jaccard > 0.85 极可能同义，跳过LLM
        if jaccard > 0.85:
            return {
                "is_same": True,
                "confidence": 0.9,
                "merged_name": max(
                    node_a.get("name", ""), node_b.get("name", ""),
                    key=lambda n: len(n)
                ),
                "reason": "high_jaccard_match",
            }

        if not self.client:
            return None

        try:
            prompt = SEMANTIC_MERGE_PROMPT.format(
                name_a=node_a.get("name", ""),
                type_a=node_a.get("memory_type", ""),
                content_a=node_a.get("content", node_a.get("definition", "")),
                name_b=node_b.get("name", ""),
                type_b=node_b.get("memory_type", ""),
                content_b=node_b.get("content", node_b.get("definition", "")),
            )
            response = await self.client.chat.completions.create(
                model=self._model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
                timeout=20,
            )
            raw = response.choices[0].message.content.strip()
            parsed = self._parse_json_response(raw)
            if parsed and parsed.get("is_same") and parsed.get("confidence", 0) >= 0.6:
                return parsed
        except Exception as e:
            logger.warning(f"LLM合并检测失败: {e}")

        return None

    async def detect_conflicts(
        self, new_node: dict, existing_node: dict
    ) -> Optional[ConflictReport]:
        """检测新旧知识之间的冲突"""
        if not self.client:
            return None

        try:
            prompt = CONFLICT_DETECTION_PROMPT.format(
                existing_name=existing_node.get("name", ""),
                existing_content=existing_node.get("content", existing_node.get("definition", "")),
                new_name=new_node.get("name", ""),
                new_content=new_node.get("content", new_node.get("definition", "")),
            )
            response = await self.client.chat.completions.create(
                model=self._model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500,
                timeout=20,
            )
            raw = response.choices[0].message.content.strip()
            parsed = self._parse_json_response(raw)
            if parsed and parsed.get("has_conflict"):
                return ConflictReport(
                    existing_node_id=existing_node.get("id", 0),
                    existing_name=existing_node.get("name", ""),
                    existing_content=existing_node.get("content", existing_node.get("definition", "")),
                    new_content=new_node.get("content", new_node.get("definition", "")),
                    conflict_type=parsed.get("conflict_type", "contradiction"),
                    severity=parsed.get("severity", 0.5),
                    explanation=parsed.get("explanation", ""),
                    resolution_suggestion=parsed.get("resolution", ""),
                )
        except Exception as e:
            logger.warning(f"冲突检测失败: {e}")

        return None

    async def merge_nodes(
        self, primary_node: dict, secondary_nodes: list[dict]
    ) -> dict:
        """合并多个节点：保留主节点，吸收次要节点的证据"""
        merged_evidences = list(primary_node.get("evidence_json", []))
        merged_ids = list(primary_node.get("merged_from_ids", []))
        max_source_count = primary_node.get("source_count", 1)
        max_confidence = primary_node.get("confidence", 0.5)
        total_recall = primary_node.get("recall_count", 0)

        for sec in secondary_nodes:
            merged_ids.append(sec.get("id", 0))
            merged_ids.extend(sec.get("merged_from_ids", []))
            for ev in sec.get("evidence_json", []):
                if ev not in merged_evidences:
                    merged_evidences.append(ev)
            max_source_count = max(max_source_count, sec.get("source_count", 1))
            max_confidence = max(max_confidence, sec.get("confidence", 0.5))
            total_recall += sec.get("recall_count", 0)

        # 合并后提升置信度 (多源验证)
        boosted_confidence = min(1.0, max_confidence * (1.0 + 0.1 * len(secondary_nodes)))

        primary_node["merged_from_ids"] = merged_ids
        primary_node["evidence_json"] = merged_evidences
        primary_node["source_count"] = len(merged_evidences)
        primary_node["confidence"] = boosted_confidence
        primary_node["recall_count"] = total_recall
        primary_node["memory_type"] = MemoryType.SEMANTIC.value  # 合并后升级为语义记忆

        return primary_node

    async def consolidate_batch(
        self, db: AsyncSession, new_node_ids: list[int], owner_mid: Optional[int] = None
    ) -> list[MemoryConsolidationResult]:
        """
        批量合并: 对一批新节点进行去重、合并和冲突检测

        Returns:
            每个合并操作的结果列表
        """
        from app.models import MemoryNode as MemoryNodeDB

        # 获取现有节点
        all_nodes_query = select(MemoryNodeDB)
        if owner_mid is not None:
            all_nodes_query = all_nodes_query.where(MemoryNodeDB.owner_mid == owner_mid)
        all_nodes_result = await db.execute(all_nodes_query)
        all_nodes = {n.id: n for n in all_nodes_result.scalars().all()}

        new_nodes = {nid: all_nodes[nid] for nid in new_node_ids if nid in all_nodes}
        existing_nodes = {nid: n for nid, n in all_nodes.items() if nid not in new_node_ids}

        results = []
        processed = set()

        for nid, new_node in new_nodes.items():
            if nid in processed:
                continue

            node_dict = {
                "id": new_node.id,
                "name": new_node.name,
                "content": new_node.content or "",
                "definition": new_node.definition or "",
                "memory_type": new_node.memory_type or "semantic",
                "confidence": new_node.confidence or 0.5,
                "source_count": new_node.source_count or 1,
                "recall_count": new_node.recall_count or 0,
                "base_strength": new_node.base_strength,
                "stability": new_node.stability,
                "evidence_json": new_node.evidence_json or [],
                "merged_from_ids": new_node.merged_from_ids or [],
            }

            # 查找相似现有节点
            similar = []
            for eid, enode in existing_nodes.items():
                enode_dict = {
                    "id": enode.id, "name": enode.name,
                    "content": enode.content or "", "definition": enode.definition or "",
                    "memory_type": enode.memory_type or "semantic",
                    "confidence": enode.confidence or 0.5,
                    "source_count": enode.source_count or 1,
                    "evidence_json": enode.evidence_json or [],
                }
                merge_info = await self.check_semantic_merge(node_dict, enode_dict)
                if merge_info and merge_info.get("is_same"):
                    similar.append((enode_dict, merge_info))

            if similar:
                # 有相似节点 → 合并
                best_match = max(similar, key=lambda x: x[1].get("confidence", 0))
                existing_dict, merge_info = best_match

                # 使用合并后的最佳名称
                node_dict["name"] = merge_info.get("merged_name", node_dict["name"])

                merged = await self.merge_nodes(existing_dict, [node_dict])

                # 更新 DB
                stmt = (
                    sql_update(MemoryNodeDB)
                    .where(MemoryNodeDB.id == existing_dict["id"])
                    .values(
                        name=merged["name"],
                        definition=merged.get("definition", ""),
                        content=merged.get("content", ""),
                        confidence=merged["confidence"],
                        source_count=merged["source_count"],
                        evidence_json=merged["evidence_json"],
                        merged_from_ids=merged["merged_from_ids"],
                        memory_type=MemoryType.SEMANTIC.value,
                        updated_at=datetime.utcnow(),
                    )
                )
                await db.execute(stmt)

                # 删除被吸收的新节点
                await db.execute(
                    delete(MemoryNodeDB).where(MemoryNodeDB.id == nid)
                )

                # 更新内存图
                if self.store.has_node(existing_dict["id"]):
                    self.store.graph.nodes[existing_dict["id"]].update({
                        "name": merged["name"],
                        "content": merged.get("content", ""),
                        "confidence": merged["confidence"],
                        "source_count": merged["source_count"],
                    })
                if self.store.has_node(nid):
                    self.store.graph.remove_node(nid)

                results.append(MemoryConsolidationResult(
                    action="merged",
                    primary_node_id=existing_dict["id"],
                    merged_node_ids=[nid],
                    new_strength=existing_dict.get("base_strength", 0.5),
                    new_layer=MemoryLayer.LONG_TERM,
                ))
                processed.add(nid)

            else:
                # 无相似节点 → 检测冲突
                conflicts = []
                for eid, enode in existing_nodes.items():
                    enode_dict = {
                        "id": enode.id, "name": enode.name,
                        "content": enode.content or "",
                        "definition": enode.definition or "",
                    }
                    conflict = await self.detect_conflicts(node_dict, enode_dict)
                    if conflict:
                        conflicts.append(conflict)

                if conflicts:
                    results.append(MemoryConsolidationResult(
                        action="conflict_detected",
                        primary_node_id=nid,
                        conflicts=conflicts,
                        new_strength=node_dict.get("base_strength", 0.5),
                        new_layer=MemoryLayer.SHORT_TERM,
                    ))
                else:
                    results.append(MemoryConsolidationResult(
                        action="kept_new",
                        primary_node_id=nid,
                        new_strength=node_dict.get("base_strength", 0.5),
                        new_layer=MemoryLayer.SHORT_TERM,
                    ))

        await db.commit()
        return results

    @staticmethod
    def _parse_json_response(raw: str) -> Optional[dict]:
        """从 LLM 响应中提取 JSON"""
        import json as json_module
        json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if json_match:
            raw = json_match.group(1)
        brace_start = raw.find("{")
        brace_end = raw.rfind("}")
        if brace_start != -1 and brace_end != -1:
            raw = raw[brace_start:brace_end + 1]
        try:
            return json_module.loads(raw)
        except json_module.JSONDecodeError:
            return None
