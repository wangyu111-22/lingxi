"""
灵犀 LingXi — 知识编译路由

提供视频知识编译的 API 端点：
- POST /compile/video  — 启动编译（后台任务）
- GET  /compile/status/{task_id} — 查询编译进度
- GET  /compile/result/{bvid}  — 获取编译结果
"""
import uuid
import asyncio
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, get_db_context
from app.models import (
    Concept, Claim, ConceptRelation, Segment, VideoCache,
)
from app.config import settings
from app.services.knowledge_compiler import compile_video, _fmt_time
from app.services.bilibili import BilibiliService
from app.services.content_fetcher import ContentFetcher
from app.services.asr import ASRService
from app.utils import resolve_owner_mid as _resolve_owner_mid
from app.routers.auth import get_session

router = APIRouter(prefix="/compile", tags=["知识编译"])


DEMO_VIDEO_PAGES = {
    "BV1WSZ4YqEPJ": [
        {"cid": 90000101, "page": 1, "part": "机器学习问题与监督学习", "duration": 1800},
        {"cid": 90000102, "page": 2, "part": "梯度下降、回归与模型评估", "duration": 1800},
        {"cid": 90000103, "page": 3, "part": "神经网络与实践项目", "duration": 1800},
    ],
    "BV1TD4y137mP": [
        {"cid": 90000201, "page": 1, "part": "机器学习任务、误差与泛化", "duration": 1800},
        {"cid": 90000202, "page": 2, "part": "深度学习架构与训练技巧", "duration": 1800},
        {"cid": 90000203, "page": 3, "part": "Transformer 与生成模型", "duration": 1800},
    ],
    "BV1BJ4m1e7g8": [
        {"cid": 90000301, "page": 1, "part": "生成式 AI 与大语言模型基础", "duration": 1400},
        {"cid": 90000302, "page": 2, "part": "提示工程、RAG 与 Agent 工具调用", "duration": 1400},
        {"cid": 90000303, "page": 3, "part": "应用落地、评测与风险治理", "duration": 1400},
    ],
}


# ==================== 辅助函数 ====================

def _classify_from_video_info(video_info: dict) -> Optional[str]:
    """从 B站 API video_info 判断内容类型"""
    if not video_info:
        return None
    pages = video_info.get("pages") or []
    duration = video_info.get("duration", 0)
    # 多P视频 → course（需要展开分集编译）
    if len(pages) > 1:
        return "course"
    if duration and duration < 120:
        return "short_video"
    if duration and duration > settings.max_compile_duration:
        return "course"
    return "single_video"


def _extract_season_key(video_info: dict) -> Optional[str]:
    """从 video_info 提取合集/系列标识"""
    if not video_info:
        return None
    ugc_season = video_info.get("ugc_season")
    if ugc_season:
        return str(ugc_season.get("id") or ugc_season.get("season_id") or "")
    pages = video_info.get("pages") or []
    if len(pages) > 1:
        return f"multi_p_{video_info.get('aid', '')}"
    return None


def _extract_season_name(video_info: dict) -> Optional[str]:
    """从 video_info 提取合集/系列名称"""
    if not video_info:
        return None
    ugc_season = video_info.get("ugc_season")
    if ugc_season:
        return ugc_season.get("title") or ugc_season.get("name") or "合集视频"
    pages = video_info.get("pages") or []
    if len(pages) > 1:
        return video_info.get("title", "多P视频")
    return None


# ==================== 任务状态存储 ====================

compile_tasks: dict[str, dict] = {}
compile_task_lock = asyncio.Lock()


# ==================== 请求/响应模型 ====================

class CompileRequest(BaseModel):
    """编译请求"""
    bvid: str
    session_id: str
    cid: Optional[int] = None  # 可选，指定分P进行单集编译
    page_title: Optional[str] = None  # 可选，分集标题


class CompileTaskResponse(BaseModel):
    """编译任务响应"""
    task_id: str
    message: str


class CompileStatusResponse(BaseModel):
    """编译状态响应"""
    status: str  # running / completed / failed
    progress: float
    message: str


# ==================== GET /compile/pages/{bvid} ====================

@router.get("/pages/{bvid}")
async def get_video_pages(
    bvid: str,
    session_id: str = Query(..., description="会话ID"),
):
    """
    获取多P视频的分集列表，用于展开课程目录
    """
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="未登录或会话已过期")
    cookies = session.get("cookies", {})
    user_info = session.get("user_info", {})
    mid = int(user_info.get("mid") or cookies.get("DedeUserID") or 0)

    if mid == 0:
        local_pages = DEMO_VIDEO_PAGES.get(bvid)
        if local_pages:
            async with get_db_context() as local_db:
                video_result = await local_db.execute(
                    select(VideoCache).where(VideoCache.bvid == bvid)
                )
                video = video_result.scalars().first()
            return {
                "bvid": bvid,
                "title": video.title if video else bvid,
                "total_duration": video.duration if video else sum(p["duration"] for p in local_pages),
                "pages_count": len(local_pages),
                "pages": local_pages,
            }
        bili = BilibiliService()
    else:
        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID"),
        )
    try:
        video_info = await bili.get_video_info(bvid)
        if not video_info:
            raise HTTPException(status_code=404, detail="视频不存在")
        pages = video_info.get("pages") or []
        result_pages = []
        for p in pages:
            result_pages.append({
                "cid": p.get("cid"),
                "page": p.get("page"),
                "part": p.get("part", f"第{p.get('page', '?')}集"),
                "duration": p.get("duration", 0),
            })
        return {
            "bvid": bvid,
            "title": video_info.get("title", ""),
            "total_duration": video_info.get("duration", 0),
            "pages_count": len(pages),
            "pages": result_pages,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取分集列表失败 [{bvid}]: {e}")
        raise HTTPException(status_code=500, detail=f"获取分集失败: {e}")
    finally:
        await bili.close()


# ==================== POST /compile/video ====================

@router.post("/video", response_model=CompileTaskResponse)
async def compile_video_endpoint(
    request: CompileRequest,
    background_tasks: BackgroundTasks,
):
    """
    启动视频知识编译（后台任务）

    将视频字幕编译为 Concept-Claim-Evidence 三级知识结构
    """
    task_id = str(uuid.uuid4())

    compile_tasks[task_id] = {
        "status": "running",
        "progress": 0.0,
        "message": "编译初始化中...",
        "bvid": request.bvid,
        "session_id": request.session_id,
        "dataset_version": str(uuid.uuid4()),
    }

    background_tasks.add_task(
        _compile_video_task,
        task_id,
        request.bvid,
        request.session_id,
        request.cid,
        request.page_title,
    )

    return CompileTaskResponse(task_id=task_id, message="编译已开始")


async def _compile_video_task(
    task_id: str,
    bvid: str,
    session_id: str,
    page_cid: Optional[int] = None,
    page_title: Optional[str] = None,
):
    """后台编译任务。page_cid 可选，用于分集编译"""
    try:
        is_single_page = page_cid is not None
        compile_tasks[task_id]["status"] = "running"
        compile_tasks[task_id]["progress"] = 0.1
        compile_tasks[task_id]["message"] = "正在获取视频内容..."

        session = await get_session(session_id)
        cookies = (session or {}).get("cookies", {})

        bili = BilibiliService(
            sessdata=cookies.get("SESSDATA"),
            bili_jct=cookies.get("bili_jct"),
            dedeuserid=cookies.get("DedeUserID"),
        )
        asr_service = ASRService()
        content_fetcher = ContentFetcher(bili, asr_service)

        try:
            if compile_task_lock.locked():
                compile_tasks[task_id]["progress"] = 0.05
                compile_tasks[task_id]["message"] = "已有视频正在编译，正在排队..."

            async with compile_task_lock:
                compile_tasks[task_id]["progress"] = 0.2
                compile_tasks[task_id]["message"] = "正在编译知识结构..."

                sync_video_title = page_title or bvid
                sync_owner_mid = None

                async with get_db_context() as db:
                    vc_result = await db.execute(
                        select(VideoCache).where(VideoCache.bvid == bvid)
                    )
                    video_cache = vc_result.scalars().first()

                    if not video_cache or not video_cache.duration:
                        try:
                            video_info = await bili.get_video_info(bvid)
                            if video_info:
                                duration = video_info.get("duration") or 0
                                if not video_cache:
                                    video_cache = VideoCache(
                                        bvid=bvid,
                                        cid=video_info.get("cid"),
                                        title=video_info.get("title", "未知标题"),
                                        description=video_info.get("desc", ""),
                                        owner_name=(video_info.get("owner") or {}).get("name", ""),
                                        owner_mid=(video_info.get("owner") or {}).get("mid"),
                                        duration=duration,
                                        pic_url=video_info.get("pic", ""),
                                        source_type="bilibili",
                                        source_url=f"https://www.bilibili.com/video/{bvid}",
                                        content_source="unknown",
                                        is_processed=False,
                                        extraction_status="pending",
                                        session_id=session_id,
                                        content_category=_classify_from_video_info(video_info),
                                        series_key=_extract_season_key(video_info),
                                        series_name=_extract_season_name(video_info),
                                    )
                                    db.add(video_cache)
                                    await db.flush()
                                    await db.commit()
                                    logger.info(f"[{bvid}] 预创建 VideoCache: duration={duration}s, category={video_cache.content_category}")
                                elif not video_cache.duration:
                                    video_cache.duration = duration
                                    video_cache.content_category = video_cache.content_category or _classify_from_video_info(video_info)
                                    video_cache.series_key = video_cache.series_key or _extract_season_key(video_info)
                                    await db.flush()
                                    await db.commit()
                        except Exception as e:
                            logger.warning(f"[{bvid}] 获取视频信息失败(预检查): {e}")

                    if not is_single_page:
                        if video_cache and video_cache.duration and video_cache.duration > settings.max_compile_duration:
                            hours = video_cache.duration / 3600
                            hint = ""
                            if video_cache.content_category == "course":
                                hint = "这是多集课程合集，请点击左侧展开箭头，选择单集编译。"
                            elif hours > 24:
                                hint = "疑似多集课程合集，请检查确认。"
                            compile_tasks[task_id]["status"] = "failed"
                            compile_tasks[task_id]["message"] = (
                                f"❌ 视频时长 {hours:.1f} 小时，超过编译上限 {settings.max_compile_duration / 3600:.0f} 小时。 "
                                + hint
                            )
                            logger.warning(f"[{bvid}] 编译被拒绝: 时长 {hours:.1f}h > 上限 {settings.max_compile_duration / 3600:.0f}h")
                            return

                    sync_owner_mid = await _resolve_owner_mid(db, session_id)
                    sync_video_title = (video_cache.title if video_cache and video_cache.title else (page_title or bvid))
                    result = await compile_video(
                        db=db,
                        bvid=bvid,
                        session_id=session_id,
                        content_fetcher=content_fetcher,
                        owner_mid=sync_owner_mid,
                        page_cid=page_cid,
                        page_title=page_title,
                    )

                if result.get("concept_count", 0) <= 0 or result.get("claim_count", 0) <= 0:
                    compile_tasks[task_id]["status"] = "failed"
                    compile_tasks[task_id]["progress"] = 0.0
                    compile_tasks[task_id]["message"] = "编译失败：AI 未从视频文字中提取到有效话题和论断，请确认视频有字幕/ASR文本且已配置 LLM API Key"
                    logger.warning(f"[{bvid}] 编译无有效知识结果: {result}")
                    return

                compile_tasks[task_id]["status"] = "completed"
                compile_tasks[task_id]["progress"] = 1.0
                compile_tasks[task_id]["message"] = (
                    f"编译完成: {result['concept_count']} 个概念, "
                    f"{result['claim_count']} 个论断, "
                    f"{result['peak_count']} 个知识峰值"
                )
                logger.info(f"[{bvid}] 编译任务完成: {result}")

                if result.get("concept_count", 0) > 0:
                    try:
                        from app.routers.collection import _sync_video_to_tree
                        async with get_db_context() as sync_db:
                            sync_result = await _sync_video_to_tree(
                                sync_db, bvid, sync_video_title, sync_owner_mid, session_id
                            )
                            await sync_db.commit()
                        logger.info(f"[{bvid}] 自动同步知识树: {sync_result}")
                    except Exception as sync_err:
                        logger.warning(f"[{bvid}] 自动同步知识树失败: {sync_err}")

        finally:
            await bili.close()

    except Exception as e:
        error_msg = str(e)
        if "database is locked" in error_msg:
            error_msg = "数据库繁忙，请稍后重试（并发编译过多）"
        logger.error(f"编译任务失败 [{bvid}]: {e}")
        compile_tasks[task_id]["status"] = "failed"
        compile_tasks[task_id]["progress"] = 0.0
        compile_tasks[task_id]["message"] = f"编译失败: {error_msg}"


# ==================== GET /compile/status/{task_id} ====================

@router.get("/status/{task_id}", response_model=CompileStatusResponse)
async def get_compile_status(
    task_id: str,
    session_id: str = Query(..., description="会话ID"),
):
    """查询编译任务状态"""
    if task_id not in compile_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = compile_tasks[task_id]
    if task.get("session_id") != session_id:
        raise HTTPException(status_code=404, detail="任务不存在")
    return CompileStatusResponse(
        status=task["status"],
        progress=task["progress"],
        message=task["message"],
    )


# ==================== GET /compile/status/{task_id}/stream (SSE) ====================

@router.get("/status/{task_id}/stream")
async def stream_compile_status(
    task_id: str,
    session_id: str = Query(..., description="会话ID"),
):
    """通过 SSE 实时推送编译进度（替代轮询）"""
    if task_id not in compile_tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    task = compile_tasks[task_id]
    if task.get("session_id") != session_id:
        raise HTTPException(status_code=404, detail="任务不存在")

    async def event_stream():
        last_snapshot = None
        while True:
            task = compile_tasks.get(task_id)
            if not task:
                break
            current_progress = task.get("progress", 0)
            snapshot = (task.get("status"), current_progress, task.get("message"))
            # 状态、进度或消息任一变化时推送，确保终态不会因进度相同而丢失。
            if snapshot != last_snapshot:
                last_snapshot = snapshot
                yield f"data: {json.dumps({'status': task['status'], 'progress': current_progress, 'message': task['message']})}\n\n"
            if task["status"] in ("completed", "failed"):
                break
            await asyncio.sleep(1.5)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ==================== GET /compile/result/{bvid} ====================

@router.get("/result/{bvid}")
async def get_compile_result(
    bvid: str,
    session_id: str = Query(..., description="会话ID"),
    page_cid: Optional[int] = Query(None, description="分P cid，用于分集结果过滤"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取视频的完整编译结果

    返回 Concept-Claim-Evidence 结构 + 时间轴密度 + 前置关系
    page_cid 可选，用于分集编译时只返回该分集的结果
    """
    owner_mid = await _resolve_owner_mid(db, session_id) if session_id else None
    is_page = bool(page_cid)

    # 获取视频信息
    vc_query = select(VideoCache).where(VideoCache.bvid == bvid)
    if owner_mid is not None:
        vc_query = vc_query.where(VideoCache.owner_mid == owner_mid)
    vc_result = await db.execute(vc_query)
    video_cache = vc_result.scalars().first()

    # 如果 VideoCache 不存在，视频未编译 → 返回 404
    if not video_cache:
        raise HTTPException(status_code=404, detail="视频未编译，请先编译")

    video_title = video_cache.title or "未知标题"
    video_duration = video_cache.duration

    # 获取 Concepts（全局共享，不过滤 page_cid）
    concept_query = select(Concept)
    if owner_mid is not None:
        concept_query = concept_query.where(Concept.owner_mid == owner_mid)
    concept_rows = await db.execute(concept_query)
    all_concepts = concept_rows.scalars().all()

    # 获取与此视频关联的 Claims（按 page_cid 过滤）
    # 分集请求必须严格按 page_cid 返回，不能回退到整集/其他分集数据。
    # 否则合集里未编译的子视频会显示成第一集或上一集的内容。
    claim_query = select(Claim).where(Claim.video_bvid == bvid)
    if owner_mid is not None:
        claim_query = claim_query.where(Claim.owner_mid == owner_mid)
    if is_page:
        claim_query = claim_query.where(Claim.page_cid == page_cid)
        claim_rows = await db.execute(claim_query)
        all_claims = claim_rows.scalars().all()
    else:
        claim_rows = await db.execute(claim_query)
        all_claims = claim_rows.scalars().all()

    # 建立 concept_id -> claims 映射
    concept_id_to_claims: dict[int, list] = {}
    relevant_concept_ids = set()
    for cl in all_claims:
        relevant_concept_ids.add(cl.concept_id)
        concept_id_to_claims.setdefault(cl.concept_id, []).append(cl)

    # 只返回与此视频相关的概念
    relevant_concepts = [c for c in all_concepts if c.id in relevant_concept_ids]

    # 构建 concepts 响应
    concepts_response = []
    for concept in relevant_concepts:
        claims_list = concept_id_to_claims.get(concept.id, [])
        claims_response = []
        for cl in claims_list:
            time_label = ""
            if cl.start_time is not None and cl.end_time is not None:
                time_label = f"{_fmt_time(cl.start_time)}-{_fmt_time(cl.end_time)}"
            claims_response.append({
                "id": cl.id,
                "statement": cl.statement,
                "type": cl.claim_type,
                "confidence": cl.confidence,
                "time": time_label,
                "start_time": cl.start_time,
                "end_time": cl.end_time,
                "raw_text": cl.raw_text or "",
            })

        concepts_response.append({
            "id": concept.id,
            "name": concept.name,
            "definition": concept.definition or "",
            "difficulty": concept.difficulty,
            "source_count": concept.source_count,
            "claims": claims_response,
        })

    # 获取 Segments（按 page_cid 过滤）
    seg_query = select(Segment).where(Segment.video_bvid == bvid)
    if is_page:
        seg_query = seg_query.where(Segment.page_cid == page_cid)
    if owner_mid is not None:
        seg_query = seg_query.where(Segment.owner_mid == owner_mid)
    seg_rows = await db.execute(seg_query.order_by(Segment.segment_index))
    segments = seg_rows.scalars().all()

    # 构建 timeline
    timeline = []
    for seg in segments:
        # 查找该片段时间范围内的概念
        seg_concept_names = []
        for cl in all_claims:
            if cl.start_time is not None and cl.end_time is not None:
                if seg.start_time is not None and seg.end_time is not None:
                    if cl.start_time < seg.end_time and cl.end_time > seg.start_time:
                        # 找到概念名
                        for c in relevant_concepts:
                            if c.id == cl.concept_id and c.name not in seg_concept_names:
                                seg_concept_names.append(c.name)

        entry = {
            "start": seg.start_time,
            "end": seg.end_time,
            "density": seg.knowledge_density or 0.0,
            "is_peak": seg.is_peak or False,
        }
        if seg_concept_names:
            entry["concepts"] = seg_concept_names
        timeline.append(entry)

    # 获取 ConceptRelations（只返回当前视频相关的前置关系）
    rel_query = select(ConceptRelation)
    if owner_mid is not None:
        rel_query = rel_query.where(ConceptRelation.owner_mid == owner_mid)
    rel_rows = await db.execute(rel_query)
    all_relations = rel_rows.scalars().all()

    # 构建 prerequisites 响应（只包含与当前视频相关的概念）
    concept_id_to_name = {c.id: c.name for c in relevant_concepts}
    # 也包含 prerequisite 概念（可能不在 relevant_concepts 中）
    all_concept_id_to_name = {c.id: c.name for c in all_concepts}

    prerequisites_response = []
    for rel in all_relations:
        src_name = all_concept_id_to_name.get(rel.source_concept_id)
        tgt_name = all_concept_id_to_name.get(rel.target_concept_id)
        if src_name and tgt_name:
            # 至少一端是当前视频的概念
            if rel.source_concept_id in relevant_concept_ids or rel.target_concept_id in relevant_concept_ids:
                prerequisites_response.append({
                    "source": src_name,
                    "target": tgt_name,
                    "type": rel.relation_type,
                })

    # 统计
    peak_count = sum(1 for seg in segments if seg.is_peak)

    return {
        "video": {
            "bvid": bvid,
            "title": video_title,
            "duration": video_duration,
        },
        "concepts": concepts_response,
        "timeline": timeline,
        "prerequisites": prerequisites_response,
        "stats": {
            "concept_count": len(relevant_concepts),
            "claim_count": len(all_claims),
            "peak_count": peak_count,
        },
    }
