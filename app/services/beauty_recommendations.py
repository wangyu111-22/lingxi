"""Beauty recommendation cards for Douyin and Xiaohongshu."""
from __future__ import annotations

from urllib.parse import quote


def build_beauty_recommendations(analysis: dict[str, str], scene: str = "") -> list[dict[str, str]]:
    """Build platform jump cards from image analysis text."""
    text = " ".join([
        scene or "",
        analysis.get("scene_summary", ""),
        analysis.get("movement_summary", ""),
        analysis.get("style_advice", ""),
    ])
    tags = _infer_tags(text)
    primary = " ".join(tags[:3])

    cards = [
        _card(
            "douyin",
            "抖音视频",
            f"{primary} 妆容教程",
            "打开抖音搜索匹配的视频教程，适合直接看步骤和上脸效果。",
        ),
        _card(
            "xiaohongshu",
            "小红书笔记",
            f"{primary} 新手教程",
            "打开小红书搜索图文笔记，适合看产品、步骤拆解和前后对比。",
        ),
        _card(
            "douyin",
            "抖音趋势",
            f"{primary} 穿搭 拍照 姿势",
            "根据当前脸型/风格建议扩展到短视频穿搭和拍照姿势参考。",
        ),
        _card(
            "xiaohongshu",
            "小红书方案",
            f"{primary} 日常通勤 妆容 穿搭",
            "把妆容、发型、服装配色一起看，方便形成完整出门方案。",
        ),
    ]
    return cards


def build_outfit_recommendations(context: str = "") -> list[dict[str, str]]:
    """Build platform jump cards for outfit references."""
    tags = _infer_outfit_tags(context)
    primary = " ".join(tags[:3])
    return [
        _card(
            "douyin",
            "抖音穿搭",
            f"{primary} 穿搭教程",
            "打开抖音查看同风格短视频，适合快速参考上身效果和搭配节奏。",
        ),
        _card(
            "xiaohongshu",
            "小红书穿搭",
            f"{primary} OOTD",
            "打开小红书查看图文穿搭笔记，适合参考单品、配色和拍照姿势。",
        ),
        _card(
            "douyin",
            "抖音趋势",
            f"{primary} 显高显瘦 穿搭",
            "根据身形和场景扩展显高显瘦方案，适合看真实动态展示。",
        ),
        _card(
            "xiaohongshu",
            "小红书方案",
            f"{primary} 日常通勤 穿搭公式",
            "把天气、场合、风格和单品组合成可直接照着穿的方案。",
        ),
    ]


def _infer_tags(text: str) -> list[str]:
    rules = [
        ("单眼皮", ["单眼皮", "肿眼泡", "大眼妆"]),
        ("肿眼泡", ["单眼皮", "肿眼泡", "消肿眼妆"]),
        ("圆脸", ["圆脸", "修容", "氛围妆"]),
        ("长脸", ["长脸", "缩短中庭", "横向腮红"]),
        ("方脸", ["方脸", "柔和修容", "发型修饰"]),
        ("菱形脸", ["菱形脸", "颧骨修饰", "温柔妆"]),
        ("通勤", ["通勤", "低饱和", "干净妆"]),
        ("约会", ["约会", "甜美", "氛围感"]),
        ("证件照", ["证件照", "自然底妆", "提气色"]),
        ("千金", ["古早千金妆", "单眼皮", "新手化妆"]),
    ]
    for needle, tags in rules:
        if needle in text:
            return tags
    return ["新手化妆", "自然放大双眼", "日常显气色"]


def _infer_outfit_tags(text: str) -> list[str]:
    rules = [
        ("通勤", ["通勤", "干净利落", "显高"]),
        ("上班", ["通勤", "轻商务", "低饱和"]),
        ("约会", ["约会", "氛围感", "温柔"]),
        ("校园", ["校园", "清爽少年感", "日常"]),
        ("拍照", ["拍照", "上镜", "氛围感"]),
        ("显瘦", ["显瘦", "比例优化", "遮肉"]),
        ("显高", ["显高", "短上衣高腰", "比例优化"]),
        ("运动", ["运动休闲", "舒适", "户外"]),
        ("街头", ["街头", "酷帅", "层次感"]),
        ("复古", ["复古", "港风", "配色"]),
        ("雨", ["雨天", "防水", "通勤"]),
        ("热", ["夏季", "清爽", "防晒"]),
        ("冷", ["秋冬", "保暖", "层次穿搭"]),
    ]
    for needle, tags in rules:
        if needle in text:
            return tags
    return ["日常", "清爽", "比例优化"]


def _card(platform: str, label: str, query: str, reason: str) -> dict[str, str]:
    if platform == "douyin":
        url = f"https://www.douyin.com/search/{quote(query)}?type=video"
    else:
        url = f"https://www.xiaohongshu.com/search_result?keyword={quote(query)}&source=web_search_result_notes"
    return {
        "platform": platform,
        "label": label,
        "title": query,
        "reason": reason,
        "url": url,
    }
