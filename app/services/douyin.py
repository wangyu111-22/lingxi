"""
LingXiMind 多平台接入 - 抖音公开视频/图文链接内容获取

说明：只解析用户主动提供的公开链接与页面元信息，不绕过登录、风控或私密权限。
"""
from __future__ import annotations

import html
import json
import re
from typing import Optional

import httpx
from loguru import logger


class DouyinService:
    """抖音公开内容获取。"""

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0, connect=10.0),
            follow_redirects=True,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        )

    async def close(self):
        await self.client.aclose()

    @staticmethod
    def is_douyin_url(url: str) -> bool:
        return any(host in url for host in ("douyin.com", "iesdouyin.com"))

    @staticmethod
    def extract_url(text: str) -> Optional[str]:
        """从抖音分享口令/整段文案中提取第一个链接。"""
        match = re.search(r"https?://[^\s，。；；,]+", text or "")
        if not match:
            return None
        return match.group(0).rstrip("。,.，")

    @staticmethod
    def extract_share_caption(text: str) -> str:
        """提取链接前的分享文案，作为平台页面解析失败时的标题/摘要。"""
        if not text:
            return ""
        url = DouyinService.extract_url(text)
        caption = text.split(url, 1)[0] if url else text
        caption = re.sub(r"^[\d\.\s/:a-zA-Z@]+", "", caption).strip()
        caption = caption.replace("复制此链接，打开Dou音搜索，直接观看视频！", "").strip()
        return _clean_text(caption)

    @staticmethod
    def extract_aweme_id(url: str) -> Optional[str]:
        """从抖音 URL 中提取 aweme/video/note id。"""
        patterns = [
            r"/video/(\d+)",
            r"/note/(\d+)",
            r"aweme_id=(\d+)",
            r"modal_id=(\d+)",
            r"item_ids=(\d+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        return None

    async def resolve_short_url(self, url: str) -> str:
        """解析 v.douyin.com / iesdouyin.com 等短链接。"""
        try:
            resp = await self.client.get(url)
            return str(resp.url)
        except Exception as e:
            logger.warning(f"抖音短链接解析失败: {e}")
            return url

    async def fetch_post(self, url: str) -> dict:
        """
        获取公开视频/图文的页面元信息。

        抖音公开页经常动态渲染或限制匿名访问，因此这里采用多层降级：
        HTML meta / JSON-LD -> 页面 title -> 可保存链接兜底。
        """
        share_text = url
        extracted_url = self.extract_url(url) or url
        share_caption = self.extract_share_caption(share_text)
        resolved_url = await self.resolve_short_url(extracted_url)
        aweme_id = self.extract_aweme_id(resolved_url) or self.extract_aweme_id(url)
        try:
            resp = await self.client.get(resolved_url)
            html_text = resp.text if resp.status_code == 200 else ""
            title = _clean_text(
                _extract_meta(html_text, "og:title")
                or _extract_meta(html_text, "twitter:title")
                or _extract_title(html_text)
                or ""
            )
            description = _clean_text(
                _extract_meta(html_text, "description")
                or _extract_meta(html_text, "og:description")
                or _extract_json_ld_description(html_text)
                or ""
            )
            author = _clean_text(
                _extract_meta(html_text, "og:author")
                or _extract_json_ld_author(html_text)
                or ""
            )
        except Exception as e:
            logger.warning(f"抖音页面解析失败 [{url}]: {e}")
            title, description, author = "", "", ""

        if _is_blocked_title(title):
            title = ""
            description = ""

        if not title and share_caption:
            title = _caption_to_title(share_caption)
        if not title:
            title = "抖音灵感素材"
        if not description and share_caption:
            description = share_caption
        if not description:
            description = (
                "该抖音公开链接无法直接解析完整文案，已作为灵感素材保存。"
                "可以在美美区域补充场景、风格关键词或截图，让 AI 继续生成穿搭妆容建议。"
            )

        content = "\n\n".join(
            part for part in [
                f"标题：{title}",
                f"作者：{author}" if author else "",
                f"链接：{resolved_url}",
                f"内容摘要：{description}",
                "用途：作为美美区域的潮流灵感、穿搭风格、妆容关键词和场景建议参考。",
            ] if part
        )

        return {
            "aweme_id": aweme_id or _stable_source_id(resolved_url),
            "title": title,
            "content": content,
            "author": author,
            "url": resolved_url,
        }

    def to_segments(self, post: dict) -> list[dict]:
        content = post.get("content", "")
        paragraphs = [p.strip() for p in content.split("\n") if p.strip()]
        if not paragraphs:
            return []
        segments = []
        for index, paragraph in enumerate(paragraphs):
            segments.append({
                "segment_index": index,
                "start_time": float(index),
                "end_time": float(index + 1),
                "raw_text": paragraph,
                "source_type": "trend_reference",
                "confidence": 0.72,
            })
        return segments


def _extract_meta(html_text: str, name: str) -> Optional[str]:
    if not html_text:
        return None
    patterns = [
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(name)}["\'][^>]+content=["\']([^"\']*)',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{re.escape(name)}["\']',
    ]
    for pattern in patterns:
        match = re.search(pattern, html_text, re.IGNORECASE)
        if match:
            return html.unescape(match.group(1))
    return None


def _extract_title(html_text: str) -> Optional[str]:
    match = re.search(r"<title[^>]*>(.*?)</title>", html_text or "", re.IGNORECASE | re.DOTALL)
    return html.unescape(match.group(1)) if match else None


def _extract_json_ld_description(html_text: str) -> Optional[str]:
    data = _extract_json_ld(html_text)
    if isinstance(data, dict):
        return data.get("description") or data.get("name")
    return None


def _extract_json_ld_author(html_text: str) -> Optional[str]:
    data = _extract_json_ld(html_text)
    if not isinstance(data, dict):
        return None
    author = data.get("author")
    if isinstance(author, dict):
        return author.get("name")
    if isinstance(author, str):
        return author
    return None


def _extract_json_ld(html_text: str) -> Optional[dict]:
    match = re.search(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html_text or "",
        re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return None
    try:
        data = json.loads(html.unescape(match.group(1).strip()))
        if isinstance(data, list):
            return next((item for item in data if isinstance(item, dict)), None)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", html.unescape(value or "")).strip()
    return value[:500]


def _caption_to_title(caption: str) -> str:
    caption = caption.strip()
    if not caption:
        return ""
    first_tag = re.split(r"#", caption, maxsplit=1)[0].strip()
    return (first_tag or caption)[:80]


def _is_blocked_title(title: str) -> bool:
    blocked_words = ("验证码", "安全验证", "登录", "访问受限")
    return any(word in (title or "") for word in blocked_words)


def _stable_source_id(url: str) -> str:
    import hashlib

    return "douyin_" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
