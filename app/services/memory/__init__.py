"""
LingXiMind 记忆系统 — 面向 AI Agent 的结构化长期记忆

三层记忆架构:
- Working Memory (工作记忆): 当前会话上下文，容量有限 (7±2)
- Short-term Memory (短期记忆): 近期获取的知识，24h内快速衰减
- Long-term Memory (长期记忆): 经过强化的持久知识，慢衰减，高度结构化

核心机制:
- Ebbinghaus 遗忘曲线: 基于指数衰减的记忆强度模型
- 检索强化: 每次成功检索增强记忆稳定性
- 语义去重: embedding + LLM 双层确认的跨源知识合并
- 冲突检测: 新知识与被记忆知识之间的矛盾检测
"""

from app.services.memory.models import (
    MemoryType,
    MemoryLayer,
    MemoryEvidence,
    MemoryRetrievalResult,
    ConflictReport,
    MemoryConsolidationResult,
)
from app.services.memory.forgetting import ForgettingCurve, memory_strength, reinforce_memory
from app.services.memory.store import MemoryStore
from app.services.memory.consolidation import MemoryConsolidator
from app.services.memory.retrieval import MemoryRetriever

__all__ = [
    "MemoryType",
    "MemoryLayer",
    "MemoryEvidence",
    "MemoryRetrievalResult",
    "ConflictReport",
    "MemoryConsolidationResult",
    "ForgettingCurve",
    "memory_strength",
    "reinforce_memory",
    "MemoryStore",
    "MemoryConsolidator",
    "MemoryRetriever",
]
