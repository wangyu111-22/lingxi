"""
灵犀 Agent Skills 定义 - 遵循华为小艺开放平台 Agent 规范

每个 Skill 包含:
- name: Skill 名称
- description: Skill 描述
- intents: 支持的意图列表
- actions: 可执行的动作
- resources: 依赖的资源/API
"""
from typing import List, Dict, Any
from dataclasses import dataclass, field


@dataclass
class Skill:
    name: str
    description: str
    intents: List[str] = field(default_factory=list)
    actions: List[str] = field(default_factory=list)
    resources: List[str] = field(default_factory=list)


# 灵犀 Agent 四大核心 Skill
LINGXI_SKILLS: Dict[str, Skill] = {
    "weather": Skill(
        name="天气感知Skill",
        description="感知当前天气状况，提供穿搭、出行建议。对接 Open-Meteo 免费天气 API。",
        intents=["查询天气", "今日温度", "会不会下雨", "穿什么"],
        actions=["获取当前天气", "获取7日预报", "生成穿搭建议", "生成出行提醒"],
        resources=["Open-Meteo API", "城市坐标库"],
    ),
    "learning": Skill(
        name="学习管理Skill",
        description="B站视频收藏→AI知识编译→知识树构建→学习路径规划→记忆复习。全链路学习管理。",
        intents=["学习", "复习", "编译视频", "知识树", "学习路径"],
        actions=["同步B站收藏夹", "视频编译提取知识", "构建知识图谱", "生成学习路径", "间隔复习"],
        resources=["Bilibili API", "华为盘古大模型", "ChromaDB 向量库", "SQLite 知识库"],
    ),
    "companion": Skill(
        name="陪伴树洞Skill",
        description="情绪感知与心灵陪伴。通过AI对话理解用户情绪，提供共情回应和心理健康支持。",
        intents=["心情不好", "情绪", "树洞", "陪伴", "倾听"],
        actions=["情绪识别", "日记分析", "AI共情回复", "呼吸引导"],
        resources=["华为盘古大模型", "情绪词库"],
    ),
    "beauty": Skill(
        name="穿搭美妆Skill",
        description="基于天气、用户身体数据和风格偏好，智能推荐穿搭和妆容方案。",
        intents=["穿搭", "化妆", "今天穿什么", "妆容推荐"],
        actions=["获取用户画像", "天气感知推荐", "风格匹配", "妆容分析"],
        resources=["天气 API", "用户画像库", "风格知识库"],
    ),
    "decision": Skill(
        name="智慧决策Skill",
        description="综合感知天气、时间、学习状态、情绪，AI主动决策并推送最优行动建议。",
        intents=["建议", "推荐", "决策", "帮我决定"],
        actions=["多维度上下文感知", "AI推理决策", "生成行动建议", "主动推送通知"],
        resources=["华为盘古大模型", "天气 API", "学习数据库", "用户画像"],
    ),
    "harmony": Skill(
        name="鸿蒙多端协同Skill",
        description="支持手机、平板、手表、耳机、智慧屏五端设备协同，卡片推送与语音交互。",
        intents=["多端", "协同", "手表", "耳机", "投屏"],
        actions=["设备发现", "卡片推送", "语音播报", "跨端同步"],
        resources=["HarmonyOS 意图框架", "小艺语音入口"],
    ),
}


def get_all_skills() -> List[Dict[str, Any]]:
    """获取所有 Skill 列表（用于前端展示）"""
    return [
        {
            "name": s.name,
            "description": s.description,
            "intents": s.intents,
            "actions": s.actions,
            "resources": s.resources,
        }
        for s in LINGXI_SKILLS.values()
    ]


def match_intent(text: str) -> List[str]:
    """根据用户输入匹配相关 Skill"""
    matched = []
    text_lower = text.lower()
    for key, skill in LINGXI_SKILLS.items():
        for intent in skill.intents:
            if any(word in text_lower for word in intent.split()):
                matched.append(key)
                break
    return matched if matched else ["decision"]  # 默认走决策 Skill
