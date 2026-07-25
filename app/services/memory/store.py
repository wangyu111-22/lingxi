"""
LingXiMind 记忆系统 — 记忆存储引擎

三层架构的持久化与查询:
- SQLite 持久化存储
- 内存缓存 (networkx 图，快速拓扑查询)
- 自动层级分级
"""
from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from typing import Optional

from loguru import logger
import networkx as nx
from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services.memory.forgetting import (
    memory_strength,
    reinforce_memory,
    determine_memory_layer,
)
from app.services.memory.models import (
    MemoryType,
    MemoryLayer,
    MemoryEvidence,
    MemoryStatsResponse,
)


class MemoryStore:
    """
    记忆存储引擎

    特性:
    - networkx 内存图支持快速拓扑查询
    - SQLite 持久化保证数据安全
    - 三层架构自动维护
    - 线程安全的 JSON 缓存
    - 遗忘曲线自动衰减计算
    """

    def __init__(self, graph_path: str = "./data/memory_graph.json"):
        self.graph_path = graph_path
        self.graph = nx.DiGraph()
        self._lock = threading.Lock()

    # ==================== 图操作 ====================

    def add_node(self, node_id: int, **attrs) -> None:
        self.graph.add_node(node_id, **attrs)

    def get_node(self, node_id: int) -> Optional[dict]:
        if node_id not in self.graph:
            return None
        return dict(self.graph.nodes[node_id])

    def has_node(self, node_id: int) -> bool:
        return node_id in self.graph

    def all_nodes(self, node_type: Optional[str] = None) -> list[dict]:
        """获取所有节点 (兼容 GraphStore API)"""
        result = []
        for nid, attrs in self.graph.nodes(data=True):
            if node_type and attrs.get("node_type") != node_type:
                continue
            result.append({"id": nid, **attrs})
        return result

    def node_count(self) -> int:
        return self.graph.number_of_nodes()

    def edge_count(self) -> int:
        return self.graph.number_of_edges()

    def get_children(self, node_id: int) -> list[dict]:
        """获取子节点 (part_of 关系)"""
        return self.get_neighbors(node_id, "part_of", "in")

    def get_parent(self, node_id: int) -> Optional[dict]:
        """获取父节点"""
        parents = self.get_neighbors(node_id, "part_of", "out")
        return parents[0] if parents else None

    def add_edge(self, src: int, tgt: int, **attrs) -> None:
        if src not in self.graph or tgt not in self.graph:
            return
        if self.graph.has_edge(src, tgt):
            existing = self.graph.edges[src, tgt]
            existing["weight"] = existing.get("weight", 1.0) + attrs.get("weight", 1.0)
            existing["confidence"] = max(existing.get("confidence", 0), attrs.get("confidence", 0))
        else:
            self.graph.add_edge(src, tgt, **attrs)

    def get_neighbors(self, node_id: int, relation_type: Optional[str] = None,
                      direction: str = "both") -> list[dict]:
        """获取邻居节点"""
        if node_id not in self.graph:
            return []
        results = []
        if direction in ("out", "both"):
            for _, tgt, data in self.graph.out_edges(node_id, data=True):
                if relation_type and data.get("relation_type") != relation_type:
                    continue
                node_data = self.get_node(tgt) or {}
                results.append({"id": tgt, "relation": data.get("relation_type"), **node_data})
        if direction in ("in", "both"):
            for src, _, data in self.graph.in_edges(node_id, data=True):
                if relation_type and data.get("relation_type") != relation_type:
                    continue
                node_data = self.get_node(src) or {}
                results.append({"id": src, "relation": data.get("relation_type"), **node_data})
        return results

    def get_prerequisites(self, node_id: int) -> list[dict]:
        return self.get_neighbors(node_id, "prerequisite_of", "in")

    def get_successors(self, node_id: int) -> list[dict]:
        return self.get_neighbors(node_id, "prerequisite_of", "out")

    def find_shortest_path(self, src: int, tgt: int) -> list[int]:
        """两节点间最短路径（忽略方向）"""
        if src not in self.graph or tgt not in self.graph:
            return []
        try:
            return nx.shortest_path(self.graph.to_undirected(), src, tgt)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def get_subgraph(self, root_id: int, max_depth: int = 4) -> list[int]:
        """获取子图所有节点(BFS)"""
        if root_id not in self.graph:
            return []
        visited = {root_id}
        queue = [(root_id, 0)]
        while queue:
            nid, depth = queue.pop(0)
            if depth >= max_depth:
                continue
            for neighbor in self.get_neighbors(nid, direction="both"):
                if neighbor["id"] not in visited:
                    visited.add(neighbor["id"])
                    queue.append((neighbor["id"], depth + 1))
        return list(visited)

    # ==================== 三层架构查询 ====================

    def get_nodes_by_layer(self, layer: MemoryLayer) -> list[dict]:
        """获取指定层级的所有节点"""
        return [
            {"id": nid, **attrs}
            for nid, attrs in self.graph.nodes(data=True)
            if attrs.get("memory_layer") == layer.value
        ]

    def get_all_layers_stats(self) -> dict:
        """获取三个层级的统计信息"""
        stats = {layer.value: {"count": 0, "total_strength": 0.0} for layer in MemoryLayer}
        for nid, attrs in self.graph.nodes(data=True):
            layer = attrs.get("memory_layer", "short_term")
            if layer in stats:
                stats[layer]["count"] += 1
                now = datetime.now(timezone.utc)
                strength = memory_strength(
                    base_strength=attrs.get("base_strength", 0.5),
                    stability=attrs.get("stability", 1.0),
                    last_recall=attrs.get("last_recall"),
                    created_at=attrs.get("created_at"),
                    now=now,
                )
                stats[layer]["total_strength"] += strength

        result = {}
        for layer_name, data in stats.items():
            count = data["count"]
            result[layer_name] = {
                "count": count,
                "avg_strength": round(data["total_strength"] / max(count, 1), 3),
            }
        return result

    # ==================== 记忆节点 CRUD ====================

    async def sync_to_db(
        self, db: AsyncSession, node_id: int, attrs: dict
    ) -> "MemoryNode":
        """同步单个节点到 SQLite"""
        from app.models import MemoryNode as MemoryNodeDB

        result = await db.execute(
            select(MemoryNodeDB).where(MemoryNodeDB.id == node_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            for key, val in attrs.items():
                if hasattr(existing, key) and val is not None:
                    setattr(existing, key, val)
            existing.updated_at = datetime.utcnow()
            await db.flush()
            return existing

        node = MemoryNodeDB(
            id=node_id,
            memory_type=attrs.get("memory_type", "semantic"),
            memory_layer=attrs.get("memory_layer", "short_term"),
            name=attrs.get("name", ""),
            normalized_name=attrs.get("normalized_name", ""),
            content=attrs.get("content", ""),
            definition=attrs.get("definition"),
            base_strength=attrs.get("base_strength", 0.5),
            stability=attrs.get("stability", 1.0),
            recall_count=attrs.get("recall_count", 0),
            last_recall=attrs.get("last_recall"),
            confidence=attrs.get("confidence", 0.5),
            source_count=attrs.get("source_count", 1),
            difficulty=attrs.get("difficulty", 1),
            owner_mid=attrs.get("owner_mid"),
            session_id=attrs.get("session_id"),
            merged_from_ids=attrs.get("merged_from_ids", []),
            evidence_json=attrs.get("evidence_json", []),
        )
        db.add(node)
        await db.flush()
        return node

    async def load_from_db(
        self, db: AsyncSession, owner_mid: Optional[int] = None
    ) -> None:
        """从 SQLite 加载所有记忆节点到内存图"""
        from app.models import MemoryNode as MemoryNodeDB

        self.graph.clear()
        query = select(MemoryNodeDB)
        if owner_mid is not None:
            query = query.where(MemoryNodeDB.owner_mid == owner_mid)

        result = await db.execute(query)
        nodes = result.scalars().all()

        now = datetime.now(timezone.utc)
        for node in nodes:
            # 计算当前强度
            current_strength = memory_strength(
                base_strength=node.base_strength,
                stability=node.stability,
                last_recall=node.last_recall,
                created_at=node.created_at,
                now=now,
            )
            current_layer = determine_memory_layer(
                current_strength, node.recall_count or 0,
                node.created_at, now,
            )

            self.graph.add_node(node.id, **{
                "name": node.name,
                "normalized_name": node.normalized_name,
                "content": node.content or "",
                "definition": node.definition or "",
                "memory_type": node.memory_type or "semantic",
                "memory_layer": current_layer.value,
                "base_strength": node.base_strength,
                "stability": node.stability,
                "current_strength": current_strength,
                "recall_count": node.recall_count or 0,
                "last_recall": node.last_recall,
                "confidence": node.confidence or 0.5,
                "source_count": node.source_count or 1,
                "difficulty": node.difficulty or 1,
                "created_at": node.created_at,
                "owner_mid": node.owner_mid,
                "knowledge_node_id": node.knowledge_node_id,
                "merged_from_ids": node.merged_from_ids or [],
                "evidence_json": node.evidence_json or [],
            })

        logger.info(
            f"Memory graph loaded: {self.graph.number_of_nodes()} nodes, "
            f"{self.graph.number_of_edges()} edges"
        )

        # 也加载边
        from app.models import MemoryEdge as MemoryEdgeDB
        edge_query = select(MemoryEdgeDB)
        if owner_mid is not None:
            edge_query = edge_query.where(MemoryEdgeDB.owner_mid == owner_mid)
        edge_result = await db.execute(edge_query)
        for edge in edge_result.scalars().all():
            self.graph.add_edge(edge.source_id, edge.target_id, **{
                "relation_type": edge.relation_type,
                "weight": edge.weight,
                "confidence": edge.confidence,
            })

    async def record_recall(self, db: AsyncSession, node_id: int) -> float:
        """记录一次成功检索，更新强度和稳定性"""
        node_data = self.get_node(node_id)
        if not node_data:
            return 0.0

        current_strength = node_data.get("current_strength", node_data.get("base_strength", 0.5))
        stability = node_data.get("stability", 1.0)
        recall_count = node_data.get("recall_count", 0)

        new_strength, new_stability = reinforce_memory(
            current_strength, stability, recall_count
        )

        now = datetime.now(timezone.utc)
        self.graph.nodes[node_id].update({
            "current_strength": new_strength,
            "stability": new_stability,
            "recall_count": recall_count + 1,
            "last_recall": now,
            "memory_layer": determine_memory_layer(
                new_strength, recall_count + 1,
                node_data.get("created_at", now), now,
            ).value,
        })

        # 异步更新 DB
        from app.models import MemoryNode as MemoryNodeDB
        stmt = (
            update(MemoryNodeDB)
            .where(MemoryNodeDB.id == node_id)
            .values(
                stability=new_stability,
                recall_count=recall_count + 1,
                last_recall=now,
            )
        )
        await db.execute(stmt)
        await db.commit()

        return new_strength

    async def get_memory_stats(self, db: AsyncSession, owner_mid: Optional[int] = None) -> MemoryStatsResponse:
        """获取记忆系统统计"""
        from app.models import MemoryNode as MemoryNodeDB

        query = select(MemoryNodeDB)
        if owner_mid is not None:
            query = query.where(MemoryNodeDB.owner_mid == owner_mid)
        result = await db.execute(query)
        nodes = result.scalars().all()

        stats = {
            "total_nodes": len(nodes),
            "working_count": 0, "short_term_count": 0, "long_term_count": 0,
            "episodic_count": 0, "semantic_count": 0, "procedural_count": 0,
            "total_evidences": 0,
            "needs_review": 0, "strong_count": 0,
        }
        str_sum = {"working": 0.0, "short_term": 0.0, "long_term": 0.0}

        now = datetime.now(timezone.utc)
        for node in nodes:
            ms = memory_strength(node.base_strength, node.stability,
                                 node.last_recall, node.created_at, now)
            layer = determine_memory_layer(ms, node.recall_count or 0, node.created_at, now)

            if layer == MemoryLayer.WORKING:
                stats["working_count"] += 1
                str_sum["working"] += ms
            elif layer == MemoryLayer.LONG_TERM:
                stats["long_term_count"] += 1
                str_sum["long_term"] += ms
            else:
                stats["short_term_count"] += 1
                str_sum["short_term"] += ms

            mt = node.memory_type or "semantic"
            if mt == "episodic":
                stats["episodic_count"] += 1
            elif mt == "procedural":
                stats["procedural_count"] += 1
            else:
                stats["semantic_count"] += 1
            stats["total_evidences"] += len(node.evidence_json or [])
            if ms < 0.35:
                stats["needs_review"] += 1
            if ms > 0.7:
                stats["strong_count"] += 1

        return MemoryStatsResponse(
            total_nodes=stats["total_nodes"],
            working_count=stats["working_count"],
            short_term_count=stats["short_term_count"],
            long_term_count=stats["long_term_count"],
            episodic_count=stats["episodic_count"],
            semantic_count=stats["semantic_count"],
            procedural_count=stats["procedural_count"],
            total_evidences=stats["total_evidences"],
            avg_strength_working=round(str_sum["working"] / max(stats["working_count"], 1), 3),
            avg_strength_short_term=round(str_sum["short_term"] / max(stats["short_term_count"], 1), 3),
            avg_strength_long_term=round(str_sum["long_term"] / max(stats["long_term_count"], 1), 3),
            needs_review=stats["needs_review"],
            strong_count=stats["strong_count"],
        )

    # ==================== 持久化缓存 ====================

    def save_json(self) -> None:
        """保存图到 JSON 缓存"""
        with self._lock:
            data = nx.node_link_data(self.graph, edges="links")
            import os
            os.makedirs(os.path.dirname(self.graph_path) or ".", exist_ok=True)
            with open(self.graph_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

    def load_json(self) -> bool:
        """从 JSON 缓存加载图"""
        with self._lock:
            try:
                with open(self.graph_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.graph = nx.node_link_graph(data, edges="links")
                return True
            except (FileNotFoundError, json.JSONDecodeError):
                return False
