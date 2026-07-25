"""
灵犀 LingXi — 内容安全过滤

LLM 输出后检查：防止生成有害/不当内容。
始终启用，不依赖配置开关。
"""
import re
from loguru import logger


# 敏感关键词（中文+英文）
_SENSITIVE_PATTERNS = [
    # 暴力/伤害
    r"(如何|怎么)(制作|制造).{0,5}(炸弹|武器|毒药)",
    r"(自杀|自残|伤害自己)",
    # 色情/不当
    r"(色情|淫秽|裸体|性行为)",
    # 违法
    r"(黑客|入侵|破解|盗版).{0,5}(教程|方法|工具)",
    r"(赌博|赌场|彩票).{0,5}(技巧|必胜|漏洞)",
    # 诈骗
    r"(赚钱|暴富|兼职).{0,10}(日入|日赚|月入)",
    # 歧视
    r"(种族|民族|地域).{0,5}(歧视|仇恨)",
]

# 编译正则
_COMPILED = [re.compile(p, re.IGNORECASE) for p in _SENSITIVE_PATTERNS]


class ContentGuardResult:
    """内容安全检查结果"""

    def __init__(self, safe: bool, reason: str = "", flagged: str = ""):
        self.safe = safe
        self.reason = reason
        self.flagged = flagged


def check_content(text: str) -> ContentGuardResult:
    """
    检查文本内容是否安全

    Args:
        text: 待检查的文本

    Returns:
        ContentGuardResult: safe=True 表示安全，False 表示需要拦截
    """
    if not text or len(text.strip()) < 10:
        return ContentGuardResult(safe=True)

    # 检查所有模式
    for i, pattern in enumerate(_COMPILED):
        match = pattern.search(text)
        if match:
            flagged = match.group()
            logger.warning(f"[ContentGuard] 拦截敏感内容: pattern={_SENSITIVE_PATTERNS[i]}, flagged={flagged}")
            return ContentGuardResult(
                safe=False,
                reason=f"内容包含不当信息，已被安全过滤",
                flagged=flagged,
            )

    return ContentGuardResult(safe=True)


def filter_response(text: str) -> str:
    """
    过滤响应文本，如果不安全则返回替代消息

    Args:
        text: LLM 响应的原始文本

    Returns:
        过滤后的文本
    """
    result = check_content(text)
    if not result.safe:
        return "抱歉，该回复包含不当内容，已被系统拦截。如需帮助，请换个方式提问。"
    return text


def guard_decorator(text: str) -> tuple[bool, str]:
    """
    装饰器式调用：返回 (is_safe, filtered_text)

    用于 Agent/Chat 输出管道中。
    """
    result = check_content(text)
    if not result.safe:
        return False, filter_response(text)
    return True, text
