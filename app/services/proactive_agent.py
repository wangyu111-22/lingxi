"""主动服务与小艺式意图识别服务。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ProactiveAgent:
    """轻量规则版主动服务 Agent。

    先用稳定的规则输出参赛演示所需的上下文、建议与动作，避免依赖外部 LLM key。
    后续可在这里接入 KnowledgeAgent 或小艺开放平台的真实意图参数。
    """

    session_id: str | None = None
    context: dict[str, Any] | None = None

    def today(self) -> dict[str, Any]:
        ctx = self.context or {}
        learning = ctx.get("learning", {})
        profile = ctx.get("profile", {})
        time_ctx = ctx.get("time", {})
        weather = ctx.get("weather", {})
        weak = profile.get("weak_points") or ["知识树为空，建议先导入并编译视频"]
        due = learning.get("due_reviews", 0)
        pending = learning.get("pending_videos", 0)
        period = time_ctx.get("period", "当前")
        clock = time_ctx.get("clock", "--:--")
        return {
            "greeting": f"你好，我是小灵。{period} {clock}，我已结合你的学习记录、天气和近期对话生成主动建议。",
            "context": {
                "time": f"{period} {clock}",
                "scene": f"{weather.get('city', '北京')} · {weather.get('condition', '未知')} · {weather.get('temp') or '--'}°C",
                "learning_state": f"{learning.get('nodes', 0)} 个知识节点，{learning.get('compiled_videos', 0)} 个已编译视频，{due} 个待复习",
                "device": "HarmonyOS 手机 / 手表卡片",
            },
            "profile": {
                "goal": profile.get("goal", "鸿蒙 Agent 创新赛答辩与课程学习"),
                "preference": profile.get("preference", "短解释、可追溯证据、语音复习"),
                "weak_points": weak,
                "best_time": profile.get("best_time", "21:00 - 23:00"),
            },
            "cards": [
                {
                    "id": "night-review",
                    "title": f"{period}复习提醒",
                    "description": f"当前有 {due} 个到期复习项，薄弱点：{', '.join(weak[:3])}。",
                    "trigger": "时间 + 学习进度",
                    "action_label": "开始复习",
                    "target": "/review",
                },
                {
                    "id": "uncompiled-video",
                    "title": "收藏未学提醒",
                    "description": f"小灵发现 {pending} 个资源尚未完成编译，可先生成知识树再问答。",
                    "trigger": "收藏夹变化",
                    "action_label": "前往工作台",
                    "target": "/workspace",
                },
                {
                    "id": "voice-commute",
                    "title": "碎片时间语音复习",
                    "description": "在耳机/通勤场景中，用小艺语音入口提问并听取 3 分钟解释。",
                    "trigger": "设备 + 场景",
                    "action_label": "语音问小灵",
                    "target": "/agent",
                },
            ],
            "actions": [
                {"type": "open_page", "label": "打开复习", "target": "/review"},
                {"type": "open_page", "label": "生成学习路径", "target": "/learning-path"},
                {"type": "open_page", "label": "问小灵", "target": "/agent"},
            ],
        }

    def resolve_intent(self, utterance: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        text = (utterance or "").strip()
        lower = text.lower()
        context = context or {}

        if any(k in text for k in ["复习", "昨天", "掌握", "闪卡"]):
            intent = "daily_review"
            reply = "我建议先做 5 分钟快速复习：回顾 3 个核心知识点，再用知识对战检查掌握度。"
            actions = [{"type": "open_page", "label": "开始复习", "target": "/review"}]
        elif any(k in text for k in ["学什么", "学习路径", "规划", "路线"]):
            intent = "learning_path"
            reply = "我会根据你的知识树和薄弱点生成一条学习路径，优先补齐前置概念。"
            actions = [{"type": "open_page", "label": "生成学习路径", "target": "/learning-path"}]
        elif any(k in text for k in ["题", "对战", "测试", "考"]):
            intent = "quiz"
            reply = "可以，我会从你的知识树里抽取概念生成题目，用正确率更新学习画像。"
            actions = [{"type": "open_page", "label": "开始知识对战", "target": "/game"}]
        elif any(k in text for k in ["视频", "边看", "解释", "总结", "概念"]):
            intent = "evidence_qa"
            reply = "你可以边看视频边问我。我会优先检索知识树和证据片段，并标注来源时间戳。"
            actions = [{"type": "open_page", "label": "打开小灵 Agent", "target": "/agent"}]
        elif "收藏" in text or "导入" in text:
            intent = "import_resource"
            reply = "我可以帮你从收藏夹或链接导入资源，先编译成知识树再进入复习闭环。"
            actions = [{"type": "open_page", "label": "前往工作台", "target": "/workspace"}]
        else:
            intent = "companion_chat"
            reply = "我在。你可以让我复习昨天的视频、规划今天的学习、解释某个知识点，或生成几道题。"
            actions = [{"type": "open_page", "label": "查看陪伴 Agent", "target": "/companion"}]

        return {
            "intent": intent,
            "utterance": text,
            "reply": reply,
            "context": context,
            "actions": actions,
        }
