"""
LingXiMind 知识树导航系统

收藏夹路由
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from loguru import logger
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import FavoriteFolderInfo, FavoriteFolder, FavoriteVideo, VideoCache, Segment
from app.services.bilibili import BilibiliService
from app.routers.auth import get_session
from app.utils import resolve_owner_mid as _resolve_owner_mid

router = APIRouter(prefix="/favorites", tags=["收藏夹"])


DEMO_PAGE_COUNTS = {
    "BV1WSZ4YqEPJ": 3,
    "BV1TD4y137mP": 3,
    "BV1BJ4m1e7g8": 3,
}


def _is_default_folder(folder: dict) -> bool:
    for key in ("is_default", "default", "isDefault"):
        if key in folder:
            return bool(folder.get(key))
    if folder.get("type") == 1:
        return True
    if folder.get("fav_state") == 1:
        return True
    if folder.get("attr") == 1:
        return True
    title = (folder.get("title") or "").strip()
    return title == "默认收藏夹"


def _classify_content_category_from_ugc(ugc: Optional[dict], duration: Optional[int] = None) -> Optional[str]:
    """从 B站 ugc 字段 + 时长判断内容分类"""
    # 优先检查 ugc 中的合集/系列标识
    if ugc:
        if ugc.get("season_id") or ugc.get("ogv_ep_id") or ugc.get("series_id"):
            return "series"
    # 兜底：根据时长推断（B站收藏夹API不一定返回season_id）
    if duration is not None:
        if duration > 7200:  # > 2小时 → 可能课程/合集
            return "course"
        if duration < 120:
            return "short_video"
    return "single_video"


def _extract_ugc_season_name(ugc: Optional[dict]) -> Optional[str]:
    """从 B站 ugc 字段提取合集名称"""
    if not ugc:
        return None
    section = ugc.get("section") or {}
    return section.get("title")


class OrganizePreviewRequest(BaseModel):
    folder_id: int


class OrganizePreviewItem(BaseModel):
    bvid: str
    title: str
    resource_id: int
    resource_type: int
    target_folder_id: Optional[int] = None
    target_folder_title: str
    reason: Optional[str] = None


class OrganizePreviewResponse(BaseModel):
    default_folder_id: int
    default_folder_title: str
    folders: List[FavoriteFolderInfo]
    items: List[OrganizePreviewItem]
    stats: dict


class OrganizeMoveItem(BaseModel):
    resource_id: int
    resource_type: int
    target_folder_id: int


class OrganizeExecuteRequest(BaseModel):
    default_folder_id: int
    moves: List[OrganizeMoveItem]


class CleanInvalidRequest(BaseModel):
    folder_id: int


@router.get("/list", response_model=List[FavoriteFolderInfo])
async def get_favorites_list(session_id: str = Query(..., description="会话ID")):
    """
    获取用户的收藏夹列表
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    
    cookies = session.get("cookies", {})
    user_info = session.get("user_info", {})

    # 演示账号（mid=0）或无有效 B 站 cookie：从本地数据库读取收藏夹，不从 B站 API 拉取
    mid = int(user_info.get("mid") or cookies.get("DedeUserID") or 0)
    has_valid_cookies = bool(cookies.get("SESSDATA"))
    if mid == 0 or not has_valid_cookies:
        from app.database import get_db_context
        async with get_db_context() as db:
            result = await db.execute(
                select(FavoriteFolder).where(
                    FavoriteFolder.session_id == session_id,
                    FavoriteFolder.is_selected == True,
                )
            )
            folders = result.scalars().all()
            return [
                FavoriteFolderInfo(
                    media_id=f.media_id,
                    title=f.title,
                    media_count=f.media_count or 0,
                    is_selected=f.is_selected if f.is_selected is not None else True,
                    is_default=True,
                )
                for f in folders
            ]

    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID")
        )

        folders = await bili.get_user_favorites(mid=mid)
        await bili.close()
        
        result = []
        for folder in folders:
            if not folder:
                continue
            result.append(FavoriteFolderInfo(
                media_id=folder.get("id") or folder.get("media_id"),
                title=folder.get("title") or "未命名收藏夹",
                media_count=folder.get("media_count", 0),
                is_selected=True,
                is_default=_is_default_folder(folder)
            ))
        
        return result
        
    except Exception as e:
        logger.error(f"获取收藏夹列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取收藏夹失败: {str(e)}")


@router.get("/{media_id}/videos")
async def get_favorite_videos(
    media_id: int,
    session_id: str = Query(..., description="会话ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20)
):
    """
    获取收藏夹中的视频列表
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")

    cookies = session.get("cookies", {})
    user_info = session.get("user_info", {})
    mid = int(user_info.get("mid") or cookies.get("DedeUserID") or 0)

    # 演示用户或无有效 B 站 cookie：从本地数据库返回视频列表
    has_valid_cookies = bool(cookies.get("SESSDATA"))
    if mid == 0 or not has_valid_cookies:
        from app.database import get_db_context
        from app.models import FavoriteVideo
        async with get_db_context() as db:
            # Find demo folder(s) for this session
            folder_ids_result = await db.execute(
                select(FavoriteFolder.id).where(FavoriteFolder.session_id == session_id)
            )
            folder_ids = [row[0] for row in folder_ids_result.fetchall()]
            if not folder_ids:
                return {"videos": [], "has_more": False, "total": 0}
            bvids_result = await db.execute(
                select(FavoriteVideo.bvid).where(FavoriteVideo.folder_id.in_(folder_ids))
            )
            bvids = [row[0] for row in bvids_result.fetchall()]
            if not bvids:
                return {"videos": [], "has_more": False, "total": 0}
            vc_result = await db.execute(
                select(VideoCache).where(VideoCache.bvid.in_(bvids))
            )
            videos = []
            for vc in vc_result.scalars().all():
                is_course = (vc.content_category or "single_video") == "course"
                videos.append({
                    "bvid": vc.bvid,
                    "title": vc.title,
                    "duration": vc.duration,
                    "owner": vc.owner_name or "",
                    "content_category": vc.content_category or "single_video",
                    "series_name": vc.series_name,
                    "series_key": vc.series_key,
                    "pages_count": DEMO_PAGE_COUNTS.get(vc.bvid, 1 if not is_course else 0),
                })
            return {"videos": videos, "has_more": False, "total": len(videos)}

    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID")
        )
        
        result = await bili.get_favorite_content(media_id, pn=page, ps=page_size)
        await bili.close()
        
        # 处理视频列表
        videos = []
        for media in result.get("medias", []):
            ugc = media.get("ugc") or {}
            videos.append({
                "bvid": media.get("bvid") or media.get("bv_id"),
                "title": media.get("title"),
                "cover": media.get("cover"),
                "duration": media.get("duration"),
                "owner": media.get("upper", {}).get("name"),
                "play_count": media.get("cnt_info", {}).get("play"),
                "intro": media.get("intro"),
                "is_selected": True,  # 默认选中
                "content_category": _classify_content_category_from_ugc(ugc, media.get("duration")),
                "series_name": _extract_ugc_season_name(ugc),
                "series_key": str(ugc.get("season_id")) if ugc.get("season_id") else None,
                "series_position": ugc.get("section", {}).get("index") if ugc.get("section") else None,
            })
        
        return {
            "folder_info": result.get("info"),
            "videos": videos,
            "has_more": result.get("has_more", False),
            "page": page,
            "page_size": page_size
        }
        
    except Exception as e:
        logger.error(f"获取收藏夹视频失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取视频失败: {str(e)}")


@router.get("/{media_id}/all-videos")
async def get_all_favorite_videos(
    media_id: int,
    session_id: str = Query(..., description="会话ID")
):
    """
    获取收藏夹中的所有视频（用于构建知识库）
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    
    cookies = session.get("cookies", {})
    
    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID")
        )
        
        all_videos = await bili.get_all_favorite_videos(media_id)
        await bili.close()
        
        # 处理视频列表（过滤失效视频）
        videos = []
        for media in all_videos:
            bvid = media.get("bvid") or media.get("bv_id")
            title = media.get("title", "")
            if not bvid:
                continue
            
            # 过滤失效视频
            attr = media.get("attr", 0)
            if attr == 9 or title in ["已失效视频", "已删除视频"]:
                continue
                
            videos.append({
                "bvid": bvid,
                "title": title,
                "cover": media.get("cover"),
                "duration": media.get("duration"),
                "owner": media.get("upper", {}).get("name"),
                "cid": media.get("ugc", {}).get("first_cid") if media.get("ugc") else None,
                "content_category": _classify_content_category_from_ugc(media.get("ugc"), media.get("duration")),
                "series_name": _extract_ugc_season_name(media.get("ugc")),
            })
        
        return {
            "total": len(videos),
            "videos": videos
        }
        
    except Exception as e:
        logger.error(f"获取所有视频失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取视频失败: {str(e)}")


@router.post("/organize/preview", response_model=OrganizePreviewResponse)
async def organize_preview(
    payload: OrganizePreviewRequest,
    session_id: str = Query(..., description="会话ID"),
):
    """
    预览：按已有收藏夹名称对默认收藏夹内容分类
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")

    cookies = session.get("cookies", {})
    user_info = session.get("user_info", {})

    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID"),
        )
        mid = user_info.get("mid") or cookies.get("DedeUserID")
        folders = await bili.get_user_favorites(mid=mid)
        default_folder = next((f for f in folders if _is_default_folder(f)), None)
        if not default_folder:
            raise HTTPException(status_code=400, detail="未找到默认收藏夹")

        default_folder_id = default_folder.get("id")
        if payload.folder_id and payload.folder_id != default_folder_id:
            logger.warning("传入的默认收藏夹ID不匹配，已使用接口默认收藏夹")

        candidate_folders = [f for f in folders if f.get("id") != default_folder_id]

        videos = await bili.get_all_favorite_videos(default_folder_id)

        items_data = []
        for media in videos:
            bvid = media.get("bvid") or media.get("bv_id")
            title = media.get("title") or bvid or ""
            if not bvid:
                continue
            attr = media.get("attr", 0)
            if attr == 9 or title in ["已失效视频", "已删除视频"]:
                continue

            resource_id = media.get("id") or media.get("aid") or media.get("avid")
            if not resource_id:
                continue
            try:
                resource_id = int(resource_id)
            except Exception:
                continue
            resource_type = media.get("type") or 2
            try:
                resource_type = int(resource_type)
            except Exception:
                resource_type = 2
            items_data.append(
                {
                    "bvid": bvid,
                    "title": title,
                    "resource_id": resource_id,
                    "resource_type": resource_type,
                }
            )

        items: List[OrganizePreviewItem] = []
        matched = 0
        for idx, item in enumerate(items_data):
            target_folder_id = None
            target_folder_title = default_folder.get("title", "默认收藏夹")
            reason = "待手动分类"
            items.append(
                OrganizePreviewItem(
                    bvid=item["bvid"],
                    title=item["title"],
                    resource_id=item["resource_id"],
                    resource_type=item["resource_type"],
                    target_folder_id=target_folder_id,
                    target_folder_title=target_folder_title,
                    reason=reason,
                )
            )

        await bili.close()

        folders_payload = [
            FavoriteFolderInfo(
                media_id=f.get("id"),
                title=f.get("title"),
                media_count=f.get("media_count", 0),
                is_selected=True,
                is_default=False,
            )
            for f in candidate_folders
        ]

        return OrganizePreviewResponse(
            default_folder_id=default_folder_id,
            default_folder_title=default_folder.get("title", "默认收藏夹"),
            folders=folders_payload,
            items=items,
            stats={
                "total": len(items),
                "matched": matched,
                "unmatched": len(items) - matched,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"收藏夹整理预览失败: {e}")
        raise HTTPException(status_code=500, detail=f"预览失败: {str(e)}")


@router.post("/organize/execute")
async def organize_execute(
    payload: OrganizeExecuteRequest,
    session_id: str = Query(..., description="会话ID"),
):
    """
    执行：根据预览结果批量移动收藏夹内容
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")

    cookies = session.get("cookies", {})

    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID"),
        )

        move_groups: dict[int, List[str]] = {}
        for item in payload.moves:
            if item.target_folder_id == payload.default_folder_id:
                continue
            resources = move_groups.setdefault(item.target_folder_id, [])
            resources.append(f"{item.resource_id}:{item.resource_type}")

        total_moved = 0
        for target_id, resources in move_groups.items():
            if not resources:
                continue
            await bili.move_favorite_resources(
                src_media_id=payload.default_folder_id,
                tar_media_id=target_id,
                resources=resources,
            )
            total_moved += len(resources)

        await bili.close()

        return {
            "message": "移动完成",
            "moved": total_moved,
            "groups": len(move_groups),
        }
    except Exception as e:
        logger.error(f"收藏夹整理执行失败: {e}")
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")


@router.post("/organize/clean-invalid")
async def clean_invalid_resources(
    payload: CleanInvalidRequest,
    session_id: str = Query(..., description="会话ID"),
):
    """
    清理收藏夹失效内容
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")

    cookies = session.get("cookies", {})

    try:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID"),
        )
        data = await bili.clean_favorite_resources(payload.folder_id)
        await bili.close()
        return {"message": "清理完成", "data": data}
    except Exception as e:
        logger.error(f"清理失效内容失败: {e}")
        raise HTTPException(status_code=500, detail=f"清理失败: {str(e)}")


# ==================== 本地视频库 (Issue #2) ====================

@router.get("/local-videos")
async def get_local_videos(
    session_id: str = Query(..., description="会话ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=10, le=200, description="每页数量"),
    search: Optional[str] = Query(None, description="搜索关键词（标题/UP主）"),
    min_duration: Optional[int] = Query(None, description="最小时长（秒）"),
    max_duration: Optional[int] = Query(None, description="最大时长（秒）"),
    db: AsyncSession = Depends(get_db),
):
    """获取本地已编译/缓存的视频列表（带分页和筛选）"""
    owner_mid = await _resolve_owner_mid(db, session_id)

    query = select(VideoCache)
    count_query = select(func.count()).select_from(VideoCache)

    # 用户隔离
    if owner_mid is not None:
        query = query.where(VideoCache.data_owner_mid == owner_mid)
        count_query = count_query.where(VideoCache.data_owner_mid == owner_mid)

    # 搜索筛选
    if search:
        pattern = f"%{search}%"
        search_filter = or_(
            VideoCache.title.ilike(pattern),
            VideoCache.owner_name.ilike(pattern),
            VideoCache.description.ilike(pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # 时长筛选
    if min_duration is not None:
        query = query.where(VideoCache.duration >= min_duration)
        count_query = count_query.where(VideoCache.duration >= min_duration)
    if max_duration is not None:
        query = query.where(VideoCache.duration <= max_duration)
        count_query = count_query.where(VideoCache.duration <= max_duration)

    total = await db.scalar(count_query) or 0

    result = await db.execute(
        query.order_by(VideoCache.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    videos = result.scalars().all()

    return {
        "videos": [
            {
                "bvid": v.bvid,
                "title": v.title,
                "owner_name": v.owner_name,
                "duration": v.duration,
                "pic_url": v.pic_url,
                "extraction_status": v.extraction_status,
                "knowledge_node_count": v.knowledge_node_count,
                "content_category": getattr(v, "content_category", None),
                "series_name": getattr(v, "series_name", None),
                "url": f"https://www.bilibili.com/video/{v.bvid}",
            }
            for v in videos
        ],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": max(1, (total + page_size - 1) // page_size) if total > 0 else 0,
        }
    }
