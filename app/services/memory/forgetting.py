"""
LingXiMind 记忆系统 — Ebbinghaus 遗忘曲线

实现基于时间衰减的记忆强度模型:
- 指数衰减: S(t) = S₀ × e^(-λt / σ)
- 检索强化: 每次成功召回增加稳定性
- 三阶段划分: 快速衰减期 → 缓慢衰减期 → 稳定期
- 间隔重复效应: 每次复习延长半衰期

参考: Ebbinghaus (1885), 现代间隔重复理论 (Wozniak, 1990s)
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from loguru import logger

from app.config import settings
from app.services.memory.models import (
    ForgettingParams,
    MemoryLayer,
)


# ==================== 核心强度计算 ====================

def memory_strength(
    base_strength: float,
    stability: float,
    last_recall: Optional[datetime],
    created_at: Optional[datetime],
    now: Optional[datetime] = None,
    decay_rate: Optional[float] = None,
) -> float:
    """
    计算记忆当前强度 — 基于 Ebbinghaus 指数衰减

    S(t) = S₀ × exp(-λ × t / σ)

    其中:
      S₀ = base_strength (初始强度, 受抽取置信度影响)
      λ  = decay_rate  (基础衰减率, 默认 0.15)
      t  = 距上次检索的小时数
      σ  = stability  (稳定性, 每次成功检索后增加)

    Args:
        base_strength: 初始编码强度 [0, 1]
        stability: 记忆稳定性参数 (>= 1.0, 越高越抗遗忘)
        last_recall: 上次成功检索时间
        created_at: 创建时间 (fallback)
        now: 当前时间
        decay_rate: 覆盖默认衰减率

    Returns:
        当前记忆强度 [0, 1]
    """
    if not settings.memory_ebbinghaus_enabled:
        return base_strength

    now = now or datetime.now(timezone.utc)
    ref_time = last_recall or created_at
    if ref_time is None:
        return base_strength

    # 确保 ref_time 是 offset-aware
    if ref_time.tzinfo is None:
        from datetime import timezone as tz
        ref_time = ref_time.replace(tzinfo=tz.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    elapsed_hours = (now - ref_time).total_seconds() / 3600.0
    if elapsed_hours < 0:
        elapsed_hours = 0

    lambda_ = decay_rate or settings.memory_decay_base_rate
    sigma = max(stability, 0.1)  # 防止除零

    # Ebbinghaus: S = S₀ × e^(-λt/σ)
    strength = base_strength * math.exp(-lambda_ * elapsed_hours / sigma)

    return max(0.0, min(1.0, strength))


def reinforce_memory(
    current_strength: float,
    stability: float,
    recall_count: int,
    reinforcement_factor: Optional[float] = None,
) -> tuple[float, float]:
    """
    检索成功后强化记忆

    效应:
    1. 强度恢复: 衰减后的强度被提升回较高水平
    2. 稳定性增加: 每次成功检索，记忆更牢固
    3. 边际递减: 前几次复习效果显著，后期趋于稳定

    Returns:
        (new_strength, new_stability)
    """
    rf = reinforcement_factor or 1.3

    # 强度恢复: 加权平均，避免跳变
    recovery = 0.3 + 0.7 * current_strength  # 至少恢复到 0.3
    new_strength = min(1.0, recovery + (1.0 - recovery) * 0.4)

    # 稳定性增长: 边际递减
    # 第1次复习 ×1.3, 第3次 ×(1.3+0.3), 第10次接近饱和
    stability_boost = 1.0 + (rf - 1.0) * math.exp(-0.15 * recall_count)
    new_stability = stability * stability_boost

    return new_strength, new_stability


def determine_memory_layer(
    strength: float,
    recall_count: int,
    created_at: datetime,
    now: Optional[datetime] = None,
) -> MemoryLayer:
    """
    根据强度、检索次数和时间确定记忆层级

    规则:
    - strength < 0.3 且 recall_count < consolidation_threshold → SHORT_TERM
    - strength >= 0.6 且 recall_count >= consolidation_threshold → LONG_TERM
    - 其他 → SHORT_TERM (过渡态)
    - 最近 30 分钟内被检索的 → 可标记为 WORKING (由调用方决定)
    """
    now = now or datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        from datetime import timezone as tz
        created_at = created_at.replace(tzinfo=tz.utc)

    threshold = settings.memory_consolidation_threshold

    # 长期记忆: 高强度 + 足够检索次数
    if strength >= 0.6 and recall_count >= threshold:
        return MemoryLayer.LONG_TERM

    # 短期记忆: 默认状态
    return MemoryLayer.SHORT_TERM


def estimate_forgetting_time(
    stability: float,
    threshold: float = 0.2,
    decay_rate: Optional[float] = None,
) -> float:
    """
    估计记忆衰减到阈值以下需要的时间 (小时)

    用于计算下次复习时间 (类似 Anki 的 interval 计算)
    """
    lambda_ = decay_rate or settings.memory_decay_base_rate

    if lambda_ <= 0 or stability <= 0:
        return float("inf")

    # S(t) = S₀ × e^(-λt/σ) → threshold = 1.0 × e^(-λt/σ)
    # t = -σ/λ × ln(threshold)
    hours = -stability / lambda_ * math.log(max(threshold, 0.01))
    return max(1.0, hours)


@dataclass
class ForgettingCurve:
    """
    Ebbinghaus 遗忘曲线的完整状态

    追踪单个记忆节点的衰减过程，提供优化建议
    """
    params: ForgettingParams = field(default_factory=ForgettingParams)
    current_strength: float = 1.0
    last_recall: Optional[datetime] = None
    recall_count: int = 0
    layer: MemoryLayer = MemoryLayer.SHORT_TERM

    def tick(self, now: Optional[datetime] = None) -> float:
        """时间推进一步，返回当前强度"""
        now = now or datetime.now(timezone.utc)
        self.current_strength = memory_strength(
            base_strength=self.params.base_strength,
            stability=self.params.stability,
            last_recall=self.last_recall or now,
            created_at=self.last_recall or now,
            now=now,
            decay_rate=self.params.decay_rate,
        )
        self.layer = determine_memory_layer(
            self.current_strength,
            self.recall_count,
            self.last_recall or now,
            now,
        )
        return self.current_strength

    def recall(self, success: bool = True) -> float:
        """执行一次检索 (成功或失败)"""
        now = datetime.now(timezone.utc)

        if success:
            self.recall_count += 1
            self.current_strength, self.params.stability = reinforce_memory(
                self.current_strength,
                self.params.stability,
                self.recall_count,
                self.params.reinforcement_factor,
            )
        else:
            # 检索失败 → 强度下降 (但不归零)
            self.current_strength *= 0.7

        self.last_recall = now
        self.layer = determine_memory_layer(
            self.current_strength,
            self.recall_count,
            self.last_recall,
            now,
        )

        return self.current_strength

    @property
    def next_review_hours(self) -> float:
        """建议下次复习的时间间隔 (小时)"""
        return estimate_forgetting_time(
            self.params.stability,
            decay_rate=self.params.decay_rate,
        )

    @property
    def is_forgotten(self) -> bool:
        """记忆是否已基本遗忘 (强度 < 0.15)"""
        return self.current_strength < 0.15

    @property
    def needs_review(self) -> bool:
        """是否建议复习 (强度 < 0.35)"""
        return self.current_strength < 0.35
