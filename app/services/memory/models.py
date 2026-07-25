"""
LingXiMind 记忆系统 — 数据模型

定义记忆节点的核心数据结构，包括:
- MemoryType: 记忆类型 (情节/语义/过程)
- MemoryLayer: 记忆层级 (工作/短期/长期)
- MemoryEvidence: 可追溯的证据锚点
- MemoryNode: 数据库持久化模型
- ConflictReport: 记忆冲突检测报告
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


# ==================== 枚举 ====================

class MemoryType(str, Enum):
    """记忆类型 — 对应认知科学中的记忆分类"""
    EPISODIC = "episodic"         # 情节记忆：来自具体视频片段的知识
    SEMANTIC = "semantic"         # 语义记忆：跨源抽象出的概念知识
    PROCEDURAL = "procedural"     # 过程记忆：操作步骤、方法论


class MemoryLayer(str, Enum):
    """记忆层级 — 三层记忆架构"""
    WORKING = "working"           # 工作记忆：当前会话，容量 7±2
    SHORT_TERM = "short_term"     # 短期记忆：24h内，快速衰减
    LONG_TERM = "long_term"       # 长期记忆：强化后持久存储


class MemoryRelationType(str, Enum):
    """记忆关系类型"""
    PREREQUISITE_OF = "prerequisite_of"     # 前置知识
    PART_OF = "part_of"                     # 组成部分
    RELATED_TO = "related_to"               # 相关
    CONTRADICTS = "contradicts"             # 矛盾/冲突
    SUPPORTS = "supports"                   # 证据支持
    GENERALIZES = "generalizes"             # 泛化/抽象
    INSTANTIATES = "instantiates"           # 实例化
    MERGED_FROM = "merged_from"             # 合并来源标记


# ==================== Pydantic 模型 (API 层) ====================

class MemoryEvidence(BaseModel):
    """记忆证据 — 可追溯到原始来源"""
    source_type: str = "bilibili"           # bilibili / xiaohongshu / zhihu
    source_id: str = ""                     # bvid / note_id
    source_title: str = ""
    segment_id: Optional[int] = None
    start_time: Optional[float] = None      # 秒
    end_time: Optional[float] = None
    text_snippet: str = ""                  # 原文片段
    confidence: float = 0.5


class MemoryRetrievalResult(BaseModel):
    """记忆检索结果"""
    node_id: int
    name: str
    content: str
    memory_type: MemoryType
    memory_layer: MemoryLayer
    strength: float                         # 当前记忆强度 (0-1)
    relevance_score: float                  # 与查询的相关度 (0-1)
    context_boost: float = 0.0              # 上下文关联加分
    freshness_boost: float = 0.0            # 新鲜度加分
    evidence_count: int = 0
    evidences: list[MemoryEvidence] = []


class ConflictReport(BaseModel):
    """记忆冲突检测报告"""
    existing_node_id: int
    existing_name: str
    existing_content: str
    new_content: str
    conflict_type: str = "contradiction"    # contradiction / refinement / perspective_diff
    explanation: str = ""
    severity: float = 0.5                   # 冲突严重程度 0-1
    resolution_suggestion: str = ""


class MemoryConsolidationResult(BaseModel):
    """记忆合并结果"""
    action: str = ""                        # merged / kept_existing / kept_new / conflict_detected
    primary_node_id: int = 0
    merged_node_ids: list[int] = []
    new_strength: float = 0.0
    new_layer: MemoryLayer = MemoryLayer.SHORT_TERM
    conflicts: list[ConflictReport] = []


# ==================== 遗忘曲线参数 ====================

@dataclass
class ForgettingParams:
    """Ebbinghaus 遗忘曲线参数"""
    base_strength: float = 1.0              # 初始记忆强度
    stability: float = 1.0                  # 记忆稳定性 (越高越不易忘)
    decay_rate: float = 0.15               # 基础衰减率
    reinforcement_factor: float = 1.3       # 每次强化稳定性倍增系数
    short_term_hours: float = 24.0          # 短期记忆窗口 (小时)
    consolidation_threshold: int = 3        # 需多少次检索才固化为长期记忆


# ==================== API 请求/响应模型 ====================

class MemorySearchRequest(BaseModel):
    """记忆搜索请求"""
    query: str
    top_k: int = 10
    context_node_ids: list[int] = []        # 当前工作记忆中的节点ID
    min_strength: float = 0.2
    include_evidences: bool = True


class MemorySearchResponse(BaseModel):
    """记忆搜索响应"""
    query: str
    results: list[MemoryRetrievalResult]
    total_found: int
    retrieval_time_ms: float = 0.0


class MemoryConsolidateRequest(BaseModel):
    """记忆合并请求"""
    new_node_ids: list[int]                 # 待合并/检测的新节点ID列表
    owner_mid: Optional[int] = None


class MemoryStatsResponse(BaseModel):
    """记忆系统统计"""
    total_nodes: int
    working_count: int
    short_term_count: int
    long_term_count: int
    episodic_count: int
    semantic_count: int
    procedural_count: int
    total_evidences: int
    avg_strength_working: float
    avg_strength_short_term: float
    avg_strength_long_term: float
    needs_review: int = 0
    strong_count: int = 0
