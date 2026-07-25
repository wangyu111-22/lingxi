"""
LingXiMind 知识树学习导航系统

图存储服务 — networkx 内存图 + SQLite 持久化
"""
import json
import threading
from typing import Optional
from loguru import logger

try:
    import networkx as nx
except ImportError:
    nx = None
    logger.warning("networkx not installed, graph features disabled")

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import KnowledgeNode, KnowledgeEdge, NodeSegmentLink


class GraphStore:
    """
    知识图谱存储

    - networkx.DiGraph 作为内存图，支持快速查询
    - SQLite (KnowledgeNode/KnowledgeEdge 表) 作为持久化
    - graph.json 作为快速加载缓存
    """

    def __init__(self, graph_path: str = "./data/graph.json"):
        self.graph_path = graph_path
        self.graph: "nx.DiGraph" = nx.DiGraph() if nx else None
        self._json_lock = threading.Lock()

    # ==================== 节点操作 ====================

    def add_node(self, node_id: int, **attrs) -> None:
        if self.graph is None:
            return
        self.graph.add_node(node_id, **attrs)

    def get_node(self, node_id: int) -> Optional[dict]:
        if self.graph is None or node_id not in self.graph:
            return None
        return dict(self.graph.nodes[node_id])

    def has_node(self, node_id: int) -> bool:
        if self.graph is None:
            return False
        return node_id in self.graph

    def remove_node(self, node_id: int) -> None:
        if self.graph is not None and node_id in self.graph:
            self.graph.remove_node(node_id)

    def all_nodes(self, node_type: Optional[str] = None) -> list[dict]:
        if self.graph is None:
            return []
        result = []
        for nid, attrs in self.graph.nodes(data=True):
            if node_type and attrs.get("node_type") != node_type:
                continue
            result.append({"id": nid, **attrs})
        return result

    # ==================== 边操作 ====================

    def add_edge(self, src_id: int, tgt_id: int, **attrs) -> None:
        if self.graph is None:
            return
        if self.graph.has_edge(src_id, tgt_id):
            existing = self.graph.edges[src_id, tgt_id]
            existing["weight"] = existing.get("weight", 1.0) + attrs.get("weight", 1.0)
            existing["confidence"] = max(existing.get("confidence", 0), attrs.get("confidence", 0))
        else:
            self.graph.add_edge(src_id, tgt_id, **attrs)

    def get_edge(self, src_id: int, tgt_id: int) -> Optional[dict]:
        if self.graph is None or not self.graph.has_edge(src_id, tgt_id):
            return None
        return dict(self.graph.edges[src_id, tgt_id])

    # ==================== 查询操作 ====================

    def get_neighbors(self, node_id: int, relation_type: Optional[str] = None, direction: str = "out") -> list[dict]:
        """获取邻居节点（按 ID 去重）"""
        if self.graph is None or node_id not in self.graph:
            return []

        seen: set[int] = set()
        results = []

        def _add(nid: int, rel: str):
            if nid not in seen and nid != node_id:
                seen.add(nid)
                node_data = self.get_node(nid) or {}
                results.append({"id": nid, "relation": rel, **node_data})

        if direction in ("out", "both"):
            for _, tgt, data in self.graph.out_edges(node_id, data=True):
                if relation_type and data.get("relation_type") != relation_type:
                    continue
                _add(tgt, data.get("relation_type"))

        if direction in ("in", "both"):
            for src, _, data in self.graph.in_edges(node_id, data=True):
                if relation_type and data.get("relation_type") != relation_type:
                    continue
                _add(src, data.get("relation_type"))

        return results

    def get_prerequisites(self, node_id: int) -> list[dict]:
        """获取前置知识（被 prerequisite_of 关系指向本节点的源节点）"""
        return self.get_neighbors(node_id, relation_type="prerequisite_of", direction="in")

    def get_successors(self, node_id: int) -> list[dict]:
        """获取后续知识（本节点通过 prerequisite_of 关系指向的目标节点）"""
        return self.get_neighbors(node_id, relation_type="prerequisite_of", direction="out")

    def get_related(self, node_id: int) -> list[dict]:
        """获取相关节点（related_to/co_occurrence 关系，双向）"""
        return self.get_related_by_type(node_id, ["related_to", "co_occurrence"])

    def get_children(self, node_id: int) -> list[dict]:
        """获取子节点（通过 part_of/belongs_to 关系指向本节点的源节点）"""
        children = []
        for relation_type in ("part_of", "belongs_to"):
            children.extend(self.get_neighbors(node_id, relation_type=relation_type, direction="in"))
        seen = set()
        unique = []
        for child in children:
            if child["id"] in seen:
                continue
            seen.add(child["id"])
            unique.append(child)
        return unique

    def get_parent(self, node_id: int) -> Optional[dict]:
        """获取父节点（本节点通过 part_of/belongs_to 关系指向的目标节点）"""
        parents = []
        for relation_type in ("part_of", "belongs_to"):
            parents.extend(self.get_neighbors(node_id, relation_type=relation_type, direction="out"))
        return parents[0] if parents else None

    def get_subgraph_nodes(self, topic_id: int) -> list[dict]:
        """获取主题下所有节点（通过 part_of 递归）"""
        if self.graph is None:
            return []
        visited = set()
        queue = [topic_id]
        result = []
        while queue:
            nid = queue.pop(0)
            if nid in visited:
                continue
            visited.add(nid)
            node_data = self.get_node(nid)
            if node_data:
                result.append({"id": nid, **node_data})
            for child in self.get_children(nid):
                if child["id"] not in visited:
                    queue.append(child["id"])
        return result

    def find_node_by_name(self, normalized_name: str) -> Optional[int]:
        """按归一化名称查找节点"""
        if self.graph is None:
            return None
        for nid, attrs in self.graph.nodes(data=True):
            if attrs.get("normalized_name") == normalized_name:
                return nid
        return None

    def node_count(self) -> int:
        return self.graph.number_of_nodes() if self.graph else 0

    def edge_count(self) -> int:
        return self.graph.number_of_edges() if self.graph else 0

    def find_shortest_path(self, source_id: int, target_id: int) -> list[int]:
        """查找两个节点间的最短路径（忽略边方向）"""
        if self.graph is None:
            return []
        if source_id not in self.graph or target_id not in self.graph:
            return []
        try:
            return nx.shortest_path(self.graph.to_undirected(), source_id, target_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def get_topic_subgraph_ids(self, topic_id: int) -> set[int]:
        """获取主题下所有节点 ID（通过 part_of 递归 + main_topic_id 匹配）"""
        if self.graph is None:
            return set()
        ids = set()
        # BFS via part_of
        queue = [topic_id]
        while queue:
            nid = queue.pop(0)
            if nid in ids:
                continue
            ids.add(nid)
            for child in self.get_children(nid):
                if child["id"] not in ids:
                    queue.append(child["id"])
        # 也收集 main_topic_id == topic_id 的节点
        for nid, attrs in self.graph.nodes(data=True):
            if attrs.get("main_topic_id") == topic_id:
                ids.add(nid)
        return ids

    def search_nodes_by_name(self, query: str, limit: int = 20) -> list[dict]:
        """按名称模糊搜索节点"""
        if self.graph is None:
            return []
        query_lower = query.lower()
        results = []
        for nid, attrs in self.graph.nodes(data=True):
            name = (attrs.get("name") or "").lower()
            normalized = (attrs.get("normalized_name") or "").lower()
            if query_lower in name or query_lower in normalized:
                results.append({"id": nid, **attrs})
                if len(results) >= limit:
                    break
        return results

    def get_related_by_type(self, node_id: int, relation_types: list[str]) -> list[dict]:
        """获取指定关系类型的所有邻居（双向）"""
        results = []
        for rt in relation_types:
            results.extend(self.get_neighbors(node_id, relation_type=rt, direction="both"))
        # 去重
        seen = set()
        unique = []
        for r in results:
            if r["id"] not in seen:
                seen.add(r["id"])
                unique.append(r)
        return unique

    # ==================== 持久化 ====================

    def save_json(self) -> None:
        """保存图为 JSON（快速加载缓存），线程安全"""
        if self.graph is None:
            return
        with self._json_lock:
            data = nx.node_link_data(self.graph)
            with open(self.graph_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Graph saved: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges")

    def load_json(self) -> bool:
        """从 JSON 加载图，线程安全"""
        if self.graph is None:
            return False
        with self._json_lock:
            try:
                with open(self.graph_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.graph = nx.node_link_graph(data)
                logger.info(f"Graph loaded: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges")
                return True
            except FileNotFoundError:
                logger.info("No graph cache found, starting fresh")
                return False
            except Exception as e:
                logger.warning(f"Failed to load graph cache: {e}")
                return False

    async def load_from_db(self, db: AsyncSession, session_id: Optional[str] = None, owner_mid: Optional[int] = None) -> None:
        """从 SQLite 加载图（按 owner_mid 过滤，fallback 到 session_id）

        - owner_mid 不为 None: 仅加载该用户的数据（真实 B 站用户隔离）
        - session_id 不为 None 且 owner_mid 为 None: 按 session_id fallback（过渡期兼容）
        - 两者都为 None: 加载全部数据（演示/未登录用户）
        """
        if self.graph is None:
            return

        self.graph.clear()

        node_query = select(KnowledgeNode)
        edge_query = select(KnowledgeEdge)

        # 数据隔离：owner_mid 优先，session_id 为 fallback
        # demo 用户 (owner_mid=0) 使用 session_id 过滤（因为 historic 数据边可能无 owner_mid）
        if owner_mid is not None and owner_mid != 0:
            node_query = node_query.where(KnowledgeNode.owner_mid == owner_mid)
            edge_query = edge_query.where(KnowledgeEdge.owner_mid == owner_mid)
        elif owner_mid == 0:
            # demo 用户按 owner_mid=0 过滤，同时兼容 historic NULL owner_mid 的边
            node_query = node_query.where(KnowledgeNode.owner_mid == 0)
            if session_id:
                edge_query = edge_query.where(
                    (KnowledgeEdge.owner_mid == 0) |
                    ((KnowledgeEdge.owner_mid == None) & (KnowledgeEdge.session_id == session_id))
                )
            else:
                edge_query = edge_query.where(KnowledgeEdge.owner_mid == 0)
        elif session_id is not None and not session_id.startswith("demo_"):
            node_query = node_query.where(KnowledgeNode.session_id == session_id)
            edge_query = edge_query.where(KnowledgeEdge.session_id == session_id)
        # demo_ 或无 session → 不添加过滤 → 查看全部数据

        nodes_result = await db.execute(node_query)
        for node in nodes_result.scalars().all():
            self.graph.add_node(node.id, **{
                "node_type": node.node_type or "concept",
                "name": node.name or "",
                "normalized_name": node.normalized_name or "",
                "aliases": node.aliases or [],
                "definition": node.definition or "",
                "difficulty": node.difficulty if node.difficulty is not None else 1,
                "main_topic_id": node.main_topic_id,
                "confidence": node.confidence if node.confidence is not None else 0.5,
                "source_count": node.source_count if node.source_count is not None else 1,
                "review_status": node.review_status or "auto",
            })

        edges_result = await db.execute(edge_query)
        for edge in edges_result.scalars().all():
            self.graph.add_edge(edge.source_node_id, edge.target_node_id, **{
                "relation_type": edge.relation_type or "related_to",
                "weight": edge.weight if edge.weight is not None else 1.0,
                "confidence": edge.confidence if edge.confidence is not None else 0.5,
                "evidence_segment_id": edge.evidence_segment_id,
                "evidence_video_bvid": edge.evidence_video_bvid,
                "edge_id": edge.id,
            })

        logger.info(f"Graph loaded from DB: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges"
                    f" (owner_mid={owner_mid}, session_id={'set' if session_id else 'none'})")

    async def load_from_db_favorites_only(
        self, db: AsyncSession, owner_mid: Optional[int] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """只加载收藏视频关联的知识节点和边（用于知识树/游戏/学习路径/复习）

        先查 UserCollection 获取收藏的 bvid 列表，
        再通过 KnowledgeEdge.evidence_video_bvid 和 NodeSegmentLink.video_bvid
        双重路径过滤出只属于这些视频的知识节点。
        如果用户无收藏或 owner_mid 为 None，返回空图。
        """
        if self.graph is None:
            return
        self.graph.clear()

        if owner_mid is None:
            logger.info("Graph (favorites): owner_mid is None, returning empty graph")
            return

        # 1. 获取收藏的视频 bvid 列表
        from app.models import UserCollection
        result = await db.execute(
            select(UserCollection.bvid, UserCollection.title).where(UserCollection.owner_mid == owner_mid)
        )
        favorite_rows = result.fetchall()
        favorite_bvids = [row[0] for row in favorite_rows]
        favorite_titles = [row[1] for row in favorite_rows if row[1]]
        if not favorite_bvids:
            logger.info(f"Graph (favorites): no favorited videos for owner_mid={owner_mid}")
            return

        # 2. 通过两种路径找出属于收藏视频的 node_id：
        #    a) KnowledgeEdge.evidence_video_bvid — 编译时或收藏同步时创建
        #    b) NodeSegmentLink.video_bvid — 视频片段关联
        favorite_node_ids = set()

        # 路径 a: 通过 KnowledgeEdge（owner_mid 过滤放在 union 内部）
        src_query = select(KnowledgeEdge.source_node_id).where(
            KnowledgeEdge.evidence_video_bvid.in_(favorite_bvids)
        )
        tgt_query = select(KnowledgeEdge.target_node_id).where(
            KnowledgeEdge.evidence_video_bvid.in_(favorite_bvids)
        )
        if owner_mid != 0:
            src_query = src_query.where(KnowledgeEdge.owner_mid == owner_mid)
            tgt_query = tgt_query.where(KnowledgeEdge.owner_mid == owner_mid)
        edge_node_query = src_query.union(tgt_query)
        edge_result = await db.execute(edge_node_query)
        favorite_node_ids.update(row[0] for row in edge_result.fetchall())

        # 路径 b: 通过 NodeSegmentLink
        link_query = select(NodeSegmentLink.node_id).where(
            NodeSegmentLink.video_bvid.in_(favorite_bvids)
        )
        if owner_mid != 0:
            link_query = link_query.where(NodeSegmentLink.owner_mid == owner_mid)
        link_result = await db.execute(link_query)
        favorite_node_ids.update(row[0] for row in link_result.fetchall())

        # Path c: include favorited video topic nodes even before concept edges exist.
        if favorite_titles:
            topic_query = select(KnowledgeNode.id).where(
                KnowledgeNode.owner_mid == owner_mid,
                KnowledgeNode.node_type == "topic",
                KnowledgeNode.name.in_(favorite_titles),
            )
            topic_result = await db.execute(topic_query)
            favorite_node_ids.update(row[0] for row in topic_result.fetchall())

        if not favorite_node_ids:
            logger.info(f"Graph (favorites): no nodes linked to favorited videos")
            return

        # 3. 加载节点
        node_query = select(KnowledgeNode).where(
            KnowledgeNode.id.in_(favorite_node_ids)
        )
        if owner_mid != 0:
            node_query = node_query.where(KnowledgeNode.owner_mid == owner_mid)
        else:
            node_query = node_query.where(KnowledgeNode.owner_mid == 0)

        nodes_result = await db.execute(node_query)
        for node in nodes_result.scalars().all():
            self.graph.add_node(node.id, **{
                "node_type": node.node_type or "concept",
                "name": node.name or "",
                "normalized_name": node.normalized_name or "",
                "aliases": node.aliases or [],
                "definition": node.definition or "",
                "difficulty": node.difficulty if node.difficulty is not None else 1,
                "main_topic_id": node.main_topic_id,
                "confidence": node.confidence if node.confidence is not None else 0.5,
                "source_count": node.source_count if node.source_count is not None else 1,
                "review_status": node.review_status or "auto",
            })

        # 4. 加载边（只加载两端都在 favorite_node_ids 中的边）
        edge_query = select(KnowledgeEdge).where(
            KnowledgeEdge.source_node_id.in_(favorite_node_ids),
            KnowledgeEdge.target_node_id.in_(favorite_node_ids),
        )
        if owner_mid != 0:
            edge_query = edge_query.where(KnowledgeEdge.owner_mid == owner_mid)
        # demo user: edges may have NULL owner_mid historically
        edges_result = await db.execute(edge_query)
        for edge in edges_result.scalars().all():
            self.graph.add_edge(edge.source_node_id, edge.target_node_id, **{
                "relation_type": edge.relation_type or "related_to",
                "weight": edge.weight if edge.weight is not None else 1.0,
                "confidence": edge.confidence if edge.confidence is not None else 0.5,
                "evidence_segment_id": edge.evidence_segment_id,
                "evidence_video_bvid": edge.evidence_video_bvid,
                "edge_id": edge.id,
            })

        logger.info(
            f"Graph loaded (favorites only): {self.graph.number_of_nodes()} nodes, "
            f"{self.graph.number_of_edges()} edges (from {len(favorite_bvids)} favorited videos)"
        )

    async def sync_node_to_db(self, db: AsyncSession, node_id: int, attrs: dict) -> KnowledgeNode:
        """同步单个节点到 SQLite"""
        result = await db.execute(
            select(KnowledgeNode).where(KnowledgeNode.id == node_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            for key, val in attrs.items():
                if hasattr(existing, key) and val is not None:
                    setattr(existing, key, val)
            return existing

        node = KnowledgeNode(
            node_type=attrs.get("node_type", "concept"),
            name=attrs.get("name", ""),
            normalized_name=attrs.get("normalized_name", ""),
            aliases=attrs.get("aliases", []),
            definition=attrs.get("definition"),
            difficulty=attrs.get("difficulty", 1),
            main_topic_id=attrs.get("main_topic_id"),
            confidence=attrs.get("confidence", 0.5),
            source_count=attrs.get("source_count", 1),
            review_status=attrs.get("review_status", "auto"),
            session_id=attrs.get("session_id"),
            owner_mid=attrs.get("owner_mid"),
        )
        db.add(node)
        await db.flush()
        return node

    async def sync_edge_to_db(self, db: AsyncSession, src_id: int, tgt_id: int, attrs: dict) -> KnowledgeEdge:
        """同步单条边到 SQLite"""
        result = await db.execute(
            select(KnowledgeEdge).where(
                KnowledgeEdge.source_node_id == src_id,
                KnowledgeEdge.target_node_id == tgt_id,
                KnowledgeEdge.relation_type == attrs.get("relation_type", "related_to"),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.weight = max(existing.weight, attrs.get("weight", 1.0))
            existing.confidence = max(existing.confidence, attrs.get("confidence", 0.5))
            return existing

        edge = KnowledgeEdge(
            source_node_id=src_id,
            target_node_id=tgt_id,
            relation_type=attrs.get("relation_type", "related_to"),
            weight=attrs.get("weight", 1.0),
            confidence=attrs.get("confidence", 0.5),
            evidence_segment_id=attrs.get("evidence_segment_id"),
            evidence_video_bvid=attrs.get("evidence_video_bvid"),
            session_id=attrs.get("session_id"),
            owner_mid=attrs.get("owner_mid"),
        )
        db.add(edge)
        await db.flush()
        return edge
