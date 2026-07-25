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

    def today(self) -> dict[str, Any]:
        return {
            "greeting": "你好，我是小灵。现在适合用 5 分钟复习今天的视频知识点。",
            "context": {
                "time": "晚上 22:15",
                "scene": "宿舍安静时段",
                "learning_state": "今日已学习 2 个视频，尚未完成复习",
                "device": "HarmonyOS 手机 / 手表卡片",
            },
            "profile": {
                "goal": "鸿蒙 Agent 创新赛答辩与课程学习",
                "preference": "短解释、可追溯证据、语音复习",
                "weak_points": ["知识图谱编排", "主动服务场景", "学习路径表达"],
                "best_time": "21:00 - 23:00",
            },
            "cards": [
                {
                    "id": "night-review",
                    "title": "晚间 5 分钟复习",
                    "description": "你今天已经导入/学习过视频，建议用闪卡巩固 3 个核心知识点。",
                    "trigger": "时间 + 学习进度",
                    "action_label": "开始复习",
                    "target": "/review",
                },
                {
                    "id": "uncompiled-video",
                    "title": "收藏未学提醒",
                    "description": "小灵发现有收藏视频还没有编译，可先生成知识树再问答。",
                    "trigger": "收藏夹变化",
                    "action_label": "前往工作台",
                    "target": "/workspace",
                },
                {
                    "id": "voice-commute",
                    "title": "碎片时间语音复习",
                    "description": "在耳机/通勤场景中，用语音提问并听取 3 分钟解释。",
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
