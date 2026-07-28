"""
LingXiMind 知识树导航系统

认证路由 - 处理 B站登录
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text as sql_text
from app.database import get_db, get_db_context
from app.models import QRCodeResponse, LoginStatusResponse, UserSession as UserSessionModel, LingxiAccount
from app.services.bilibili import BilibiliService
from app.services.user_memory import get_personal_profile, list_recent_events, record_user_event
from datetime import datetime, timedelta
import hashlib
import hmac
import random
import re
import secrets
import uuid

router = APIRouter(prefix="/auth", tags=["认证"])

# 临时存储登录会话（生产环境应使用 Redis）
login_sessions = {}
captcha_sessions = {}


class CaptchaResponse(BaseModel):
    captcha_id: str
    question: str
    expires_in: int = 300


class AccountRegisterRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=20)
    username: str = Field(..., min_length=2, max_length=30)
    password: str = Field(..., min_length=6, max_length=64)
    captcha_id: str
    captcha_answer: str


class AccountLoginRequest(BaseModel):
    phone: str = Field(..., min_length=11, max_length=20)
    password: str = Field(..., min_length=6, max_length=64)


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\s+", "", phone)


def _validate_phone(phone: str) -> None:
    if not re.fullmatch(r"1[3-9]\d{9}", phone):
        raise HTTPException(status_code=400, detail="请输入有效的中国大陆手机号")


def _hash_password(password: str, salt: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    )
    return digest.hex()


def _verify_captcha(captcha_id: str, answer: str) -> None:
    record = captcha_sessions.get(captcha_id)
    if not record:
        raise HTTPException(status_code=400, detail="验证码已失效，请重新获取")
    if datetime.utcnow() > record["expires_at"]:
        captcha_sessions.pop(captcha_id, None)
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    if str(answer).strip() != record["answer"]:
        raise HTTPException(status_code=400, detail="验证码错误")
    captcha_sessions.pop(captcha_id, None)


async def _create_account_session(db: AsyncSession, account: LingxiAccount) -> tuple[str, dict]:
    owner_mid = account.owner_mid or -(10_000_000 + account.id)
    session_id = f"lx_account_{account.id}"
    if account.owner_mid != owner_mid:
        account.owner_mid = owner_mid

    account.last_login_at = datetime.utcnow()

    old_sessions_result = await db.execute(
        select(UserSessionModel.session_id).where(
            UserSessionModel.bili_mid == owner_mid,
            UserSessionModel.session_id != session_id,
        )
    )
    old_session_ids = [row[0] for row in old_sessions_result.all()]

    result = await db.execute(
        select(UserSessionModel).where(UserSessionModel.session_id == session_id)
    )
    db_session = result.scalars().first()
    if db_session:
        db_session.bili_mid = owner_mid
        db_session.bili_uname = account.username
        db_session.bili_face = ""
        db_session.sessdata = ""
        db_session.bili_jct = ""
        db_session.dedeuserid = str(owner_mid)
        db_session.is_valid = True
        db_session.last_active_at = datetime.utcnow()
    else:
        db_session = UserSessionModel(
            session_id=session_id,
            bili_mid=owner_mid,
            bili_uname=account.username,
            bili_face="",
            sessdata="",
            bili_jct="",
            dedeuserid=str(owner_mid),
            is_valid=True,
        )
        db.add(db_session)

    if old_session_ids:
        await _migrate_session_scoped_data(db, old_session_ids, session_id)
        await db.execute(
            sql_text(
                "UPDATE user_sessions SET is_valid = 0 WHERE bili_mid = :owner_mid AND session_id != :session_id"
            ),
            {"owner_mid": owner_mid, "session_id": session_id},
        )

    await db.commit()

    user_info = {
        "mid": owner_mid,
        "uname": account.username,
        "face": "",
        "level": 0,
    }
    login_sessions[session_id] = {
        "cookies": {},
        "user_info": user_info,
        "is_lingxi_account": True,
    }
    return session_id, user_info


async def _migrate_session_scoped_data(
    db: AsyncSession,
    old_session_ids: list[str],
    stable_session_id: str,
) -> None:
    """把账号历史临时会话数据合并到稳定账号空间。"""
    tables = [
        "video_cache",
        "segments",
        "knowledge_nodes",
        "knowledge_edges",
        "node_segment_links",
        "game_scores",
        "srs_records",
        "concepts",
        "claims",
        "concept_relations",
        "cross_video_alignments",
        "favorite_folders",
        "user_collections",
        "user_mastery",
        "conversations",
        "chat_messages",
        "memory_nodes",
        "memory_edges",
        "user_activity_events",
        "user_personal_profiles",
    ]
    for old_sid in old_session_ids:
        for table_name in tables:
            try:
                await db.execute(
                    sql_text(
                        f"UPDATE {table_name} SET session_id = :new_sid WHERE session_id = :old_sid"
                    ),
                    {"new_sid": stable_session_id, "old_sid": old_sid},
                )
            except Exception as exc:
                logger.debug(f"跳过会话数据迁移 {table_name}: {exc}")


DEMO_WORKSPACE_VIDEOS = [
    {
        "bvid": "BV1WSZ4YqEPJ",
        "title": "吴恩达机器学习全套课程",
        "description": "监督学习、梯度下降、逻辑回归、正则化、神经网络与模型评估的系统课程。",
        "owner_name": "DeepLearning.AI",
        "duration": 7200,
        "content_category": "course",
        "series_name": "人工智能基础",
        "series_key": "demo-ai-foundations",
        "series_position": 1,
    },
    {
        "bvid": "BV1TD4y137mP",
        "title": "李宏毅机器学习课程",
        "description": "从机器学习基本问题出发，覆盖深度学习、Transformer、生成模型与训练技巧。",
        "owner_name": "李宏毅",
        "duration": 5400,
        "content_category": "course",
        "series_name": "人工智能基础",
        "series_key": "demo-ai-foundations",
        "series_position": 2,
    },
    {
        "bvid": "BV1BJ4m1e7g8",
        "title": "生成式人工智能导论",
        "description": "围绕大语言模型、提示工程、生成式 AI 应用与风险治理建立完整知识框架。",
        "owner_name": "李宏毅",
        "duration": 4200,
        "content_category": "course",
        "series_name": "Agent 创新能力",
        "series_key": "demo-agent-innovation",
        "series_position": 1,
    },
    {
        "bvid": "BV1kD421H7Yg",
        "title": "大语言模型原理速览",
        "description": "用短课形式解释 Transformer、上下文窗口、推理能力、RAG 与 Agent 工具调用。",
        "owner_name": "李宏毅",
        "duration": 4800,
        "content_category": "single_video",
        "series_name": "Agent 创新能力",
        "series_key": "demo-agent-innovation",
        "series_position": 2,
    },
]


async def _ensure_demo_workspace_seed(db: AsyncSession, session_id: str) -> None:
    """Seed lightweight demo metadata so the workspace is useful before compilation."""
    from app.models import FavoriteFolder, FavoriteVideo, UserCollection, VideoCache

    owner_mid = 0
    folder_media_id = 900001
    folder_result = await db.execute(
        select(FavoriteFolder).where(
            FavoriteFolder.session_id == session_id,
            FavoriteFolder.media_id == folder_media_id,
        )
    )
    folder = folder_result.scalars().first()
    if not folder:
        folder = FavoriteFolder(
            session_id=session_id,
            media_id=folder_media_id,
            fid=folder_media_id,
            title="鸿蒙 Agent 创新赛演示课单",
            media_count=len(DEMO_WORKSPACE_VIDEOS),
            is_selected=True,
            last_sync_at=datetime.utcnow(),
        )
        db.add(folder)
        await db.flush()
    else:
        folder.media_count = len(DEMO_WORKSPACE_VIDEOS)
        folder.is_selected = True
        folder.last_sync_at = datetime.utcnow()

    for index, item in enumerate(DEMO_WORKSPACE_VIDEOS, start=1):
        video_result = await db.execute(
            select(VideoCache).where(VideoCache.bvid == item["bvid"])
        )
        video = video_result.scalars().first()
        if not video:
            video = VideoCache(
                bvid=item["bvid"],
                title=item["title"],
                description=item["description"],
                owner_name=item["owner_name"],
                duration=item["duration"],
                source_type="bilibili",
                source_url=f"https://www.bilibili.com/video/{item['bvid']}",
                content_source="demo_seed",
                is_processed=False,
                extraction_status="pending",
                session_id=session_id,
                data_owner_mid=owner_mid,
                content_category=item["content_category"],
                series_name=item["series_name"],
                series_key=item["series_key"],
                series_position=item["series_position"],
            )
            db.add(video)
        else:
            video.title = item["title"]
            video.description = item["description"]
            video.owner_name = item["owner_name"]
            video.duration = item["duration"]
            video.session_id = session_id
            video.data_owner_mid = owner_mid
            video.content_category = item["content_category"]
            video.series_name = item["series_name"]
            video.series_key = item["series_key"]
            video.series_position = item["series_position"]

        fav_result = await db.execute(
            select(FavoriteVideo).where(
                FavoriteVideo.folder_id == folder.id,
                FavoriteVideo.bvid == item["bvid"],
            )
        )
        if not fav_result.scalars().first():
            db.add(FavoriteVideo(folder_id=folder.id, bvid=item["bvid"], is_selected=True))

        coll_result = await db.execute(
            select(UserCollection).where(
                UserCollection.bvid == item["bvid"],
                UserCollection.owner_mid == owner_mid,
            )
        )
        if not coll_result.scalars().first():
            db.add(
                UserCollection(
                    bvid=item["bvid"],
                    title=item["title"],
                    owner_mid=owner_mid,
                    session_id=session_id,
                )
            )

    await db.flush()


@router.get("/captcha", response_model=CaptchaResponse)
async def generate_captcha():
    """
    生成注册验证码。

    当前为本地算术验证码，后续可替换为短信验证码服务。
    """
    # 顺手清理过期验证码，避免内存长期增长。
    now = datetime.utcnow()
    for captcha_id, record in list(captcha_sessions.items()):
        if now > record["expires_at"]:
            captcha_sessions.pop(captcha_id, None)

    left = random.randint(2, 9)
    right = random.randint(1, 9)
    captcha_id = uuid.uuid4().hex
    captcha_sessions[captcha_id] = {
        "answer": str(left + right),
        "expires_at": now + timedelta(minutes=5),
    }
    return CaptchaResponse(
        captcha_id=captcha_id,
        question=f"{left} + {right} = ?",
    )


@router.post("/register")
async def register_account(payload: AccountRegisterRequest, db: AsyncSession = Depends(get_db)):
    """手机号注册灵犀账号。"""
    phone = _normalize_phone(payload.phone)
    username = payload.username.strip()
    _validate_phone(phone)
    _verify_captcha(payload.captcha_id, payload.captcha_answer)

    if len(username) < 2:
        raise HTTPException(status_code=400, detail="用户名至少需要 2 个字符")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少需要 6 位")

    result = await db.execute(select(LingxiAccount).where(LingxiAccount.phone == phone))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")

    salt = secrets.token_hex(16)
    account = LingxiAccount(
        phone=phone,
        username=username,
        password_salt=salt,
        password_hash=_hash_password(payload.password, salt),
        is_active=True,
    )
    db.add(account)
    await db.flush()
    account.owner_mid = -(10_000_000 + account.id)

    session_id, user_info = await _create_account_session(db, account)
    await record_user_event(
        db,
        session_id,
        "account_registered",
        "注册灵犀账号",
        f"{username} 创建了自己的灵犀账号空间。",
        {"phone_tail": phone[-4:]},
        owner_mid=account.owner_mid,
    )
    await db.commit()
    return {
        "session_id": session_id,
        "user_info": user_info,
        "is_new_user": True,
    }


@router.post("/login")
async def login_account(payload: AccountLoginRequest, db: AsyncSession = Depends(get_db)):
    """手机号 + 密码登录灵犀账号。"""
    phone = _normalize_phone(payload.phone)
    _validate_phone(phone)

    result = await db.execute(select(LingxiAccount).where(LingxiAccount.phone == phone))
    account = result.scalars().first()
    if not account or not account.is_active:
        raise HTTPException(status_code=401, detail="账号不存在或已停用")

    password_hash = _hash_password(payload.password, account.password_salt)
    if not hmac.compare_digest(password_hash, account.password_hash):
        raise HTTPException(status_code=401, detail="手机号或密码错误")

    session_id, user_info = await _create_account_session(db, account)
    await record_user_event(
        db,
        session_id,
        "login",
        "登录灵犀账号",
        "恢复当前账号的学习、情绪、美美和 Agent 历史。",
        {"phone_tail": phone[-4:]},
        owner_mid=account.owner_mid,
    )
    await db.commit()
    return {
        "session_id": session_id,
        "user_info": user_info,
        "is_new_user": False,
    }


@router.get("/qrcode", response_model=QRCodeResponse)
async def generate_qrcode():
    """
    生成登录二维码
    
    返回二维码 key 和 base64 编码的二维码图片
    """
    try:
        bili = BilibiliService()
        result = await bili.generate_qrcode()
        await bili.close()
        
        # 存储会话
        login_sessions[result["qrcode_key"]] = {
            "status": "waiting"
        }
        
        return QRCodeResponse(
            qrcode_key=result["qrcode_key"],
            qrcode_url=result["qrcode_url"],
            qrcode_image_base64=result["qrcode_image_base64"]
        )
        
    except Exception as e:
        logger.error(f"生成二维码失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成二维码失败: {str(e)}")


@router.get("/qrcode/poll/{qrcode_key}", response_model=LoginStatusResponse)
async def poll_qrcode_status(qrcode_key: str, db: AsyncSession = Depends(get_db)):
    """
    轮询二维码登录状态
    """
    from sqlalchemy import select
    from app.models import UserSession as UserSessionModel
    
    try:
        bili = BilibiliService()
        result = await bili.poll_qrcode_status(qrcode_key)
        await bili.close()
        
        response = LoginStatusResponse(
            status=result["status"],
            message=result["message"]
        )
        
        # 登录成功
        if result["status"] == "confirmed":
            cookies = result.get("cookies", {})
            
            # 创建会话
            session_id = str(uuid.uuid4())
            
            # 获取用户信息
            bili_auth = BilibiliService(
                sessdata=cookies.get("SESSDATA"),
                bili_jct=cookies.get("bili_jct"),
                dedeuserid=cookies.get("DedeUserID")
            )
            
            user_info_dict = {}
            mid = None
            try:
                user_info = await bili_auth.get_user_info()
                await bili_auth.close()

                mid = int(user_info.get("mid") or cookies.get("DedeUserID"))
                
                user_info_dict = {
                    "mid": mid,
                    "uname": user_info.get("uname"),
                    "face": user_info.get("face"),
                    "level": user_info.get("level_info", {}).get("current_level")
                }
                
                # 持久化到数据库
                db_session = UserSessionModel(
                    session_id=session_id,
                    bili_mid=mid,
                    bili_uname=user_info.get("uname"),
                    bili_face=user_info.get("face"),
                    sessdata=cookies.get("SESSDATA"),
                    bili_jct=cookies.get("bili_jct"),
                    dedeuserid=str(cookies.get("DedeUserID")),
                    is_valid=True
                )
                db.add(db_session)
                await db.commit()
                
                response.user_info = user_info_dict
                
            except Exception as e:
                logger.warning(f"获取用户信息失败: {e}")
                response.user_info = {
                    "mid": cookies.get("DedeUserID"),
                    "uname": "未知用户"
                }

            # 内存缓存（为了兼容旧代码）
            login_sessions[session_id] = {
                "cookies": cookies,
                "user_info": user_info_dict,
                "refresh_token": result.get("refresh_token")
            }
            
            response.session_id = session_id

            # ===== 数据迁移：合并同B站账号的历史编译数据 =====
            if mid:
                try:
                    from sqlalchemy import text as sql_text
                    # 查找该B站用户的旧会话
                    old_sessions_result = await db.execute(
                        select(UserSessionModel.session_id).where(
                            UserSessionModel.bili_mid == mid,
                            UserSessionModel.session_id != session_id,
                            UserSessionModel.is_valid == True,
                        )
                    )
                    old_session_ids = [row[0] for row in old_sessions_result.all()]

                    migrated_count = 0
                    for old_sid in old_session_ids:
                        # 迁移所有带 session_id 的数据表
                        tables = [
                            "video_cache", "segments", "knowledge_nodes",
                            "knowledge_edges", "node_segment_links", "game_scores",
                            "srs_records", "concepts", "claims", "concept_relations",
                            "cross_video_alignments", "favorite_folders",
                        ]
                        for table_name in tables:
                            await db.execute(sql_text(
                                f"UPDATE {table_name} SET session_id = :new_sid WHERE session_id = :old_sid"
                            ), {"new_sid": session_id, "old_sid": old_sid})
                        migrated_count += 1

                    if migrated_count > 0:
                        logger.info(
                            f"数据迁移: 从 {migrated_count} 个旧会话合并到 {session_id}"
                        )
                except Exception as e:
                    logger.warning(f"数据迁移失败(非致命): {e}")

            # 清理旧的 qrcode_key
            login_sessions.pop(qrcode_key, None)
        
        return response
        
    except Exception as e:
        logger.error(f"轮询二维码状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"轮询失败: {str(e)}")


@router.get("/session/{session_id}")
async def get_session_info(session_id: str):
    """
    获取会话信息
    """
    session = login_sessions.get(session_id)
    if not session:
        async with get_db_context() as db:
            result = await db.execute(
                select(UserSessionModel).where(UserSessionModel.session_id == session_id)
            )
            db_session = result.scalar_one_or_none()
        if not db_session or not db_session.is_valid:
            raise HTTPException(status_code=404, detail="会话不存在或已过期")
        session = {
            "cookies": {
                "SESSDATA": db_session.sessdata,
                "bili_jct": db_session.bili_jct,
                "DedeUserID": db_session.dedeuserid,
            },
            "user_info": {
                "mid": db_session.bili_mid,
                "uname": db_session.bili_uname,
                "face": db_session.bili_face,
            },
        }
        login_sessions[session_id] = session

    return {"valid": True, "user_info": session.get("user_info")}


@router.delete("/session/{session_id}")
async def logout(session_id: str):
    """
    退出登录
    """
    if session_id in login_sessions:
        del login_sessions[session_id]

    async with get_db_context() as db:
        result = await db.execute(
            select(UserSessionModel).where(UserSessionModel.session_id == session_id)
        )
        db_session = result.scalar_one_or_none()
        if db_session:
            db_session.is_valid = False
            await record_user_event(
                db,
                session_id,
                "logout",
                "退出登录",
                "用户主动退出当前账号。",
                owner_mid=db_session.bili_mid,
            )
            await db.commit()
    
    return {"message": "已退出登录"}


@router.get("/restore-state")
async def restore_user_state(
    session_id: str = Query(..., description="会话ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    用户登录后恢复历史状态

    返回该用户所有已编译视频、收藏视频、记忆节点统计等，
    前端调用此接口恢复用户的知识库状态。
    """
    from app.utils import resolve_owner_mid
    from app.models import (
        VideoCache, UserCollection, Concept, Claim,
        KnowledgeNode, KnowledgeEdge, MemoryNode,
        FavoriteFolder, FavoriteVideo,
    )
    from sqlalchemy import func

    owner_mid = await resolve_owner_mid(db, session_id)
    if owner_mid is None and not session_id.startswith("demo_"):
        raise HTTPException(status_code=401, detail="会话无效")

    # 1. 已编译视频列表
    vc_query = select(VideoCache)
    if owner_mid is not None and owner_mid != 0:
        vc_query = vc_query.where(VideoCache.data_owner_mid == owner_mid)
    elif owner_mid == 0:
        vc_query = vc_query.where(VideoCache.data_owner_mid == 0)
    vc_result = await db.execute(vc_query.order_by(VideoCache.updated_at.desc()))
    compiled_videos = []
    for vc in vc_result.scalars().all():
        compiled_videos.append({
            "bvid": vc.bvid,
            "title": vc.title,
            "duration": vc.duration,
            "owner_name": vc.owner_name,
            "pic_url": vc.pic_url,
            "extraction_status": vc.extraction_status,
            "knowledge_node_count": vc.knowledge_node_count,
            "content_category": getattr(vc, "content_category", None),
            "is_processed": vc.is_processed,
            "updated_at": str(vc.updated_at) if vc.updated_at else None,
        })

    # 2. 收藏视频列表
    coll_query = select(UserCollection)
    if owner_mid is not None:
        coll_query = coll_query.where(UserCollection.owner_mid == owner_mid)
    coll_result = await db.execute(coll_query)
    collections = [
        {"bvid": r.bvid, "title": r.title, "created_at": str(r.created_at)}
        for r in coll_result.scalars().all()
    ]

    # 3. 知识节点统计
    kn_count = 0
    if owner_mid is not None:
        kn_count = await db.scalar(
            select(func.count()).select_from(KnowledgeNode).where(
                KnowledgeNode.owner_mid == owner_mid
            )
        ) or 0
    else:
        kn_count = await db.scalar(
            select(func.count()).select_from(KnowledgeNode)
        ) or 0

    # 4. 概念统计
    concept_count = 0
    if owner_mid is not None:
        concept_count = await db.scalar(
            select(func.count()).select_from(Concept).where(
                Concept.owner_mid == owner_mid
            )
        ) or 0

    # 5. 记忆节点统计
    mem_count = 0
    if owner_mid is not None:
        mem_count = await db.scalar(
            select(func.count()).select_from(MemoryNode).where(
                MemoryNode.owner_mid == owner_mid
            )
        ) or 0

    # 6. 收藏夹列表 (FavoriteFolder 无 owner_mid，按 session_id 隔离)
    ff_query = select(FavoriteFolder).where(
        FavoriteFolder.session_id == session_id
    )
    ff_result = await db.execute(ff_query)
    folders = [
        {"media_id": f.media_id, "title": f.title, "media_count": f.media_count}
        for f in ff_result.scalars().all()
    ]
    recent_events = await list_recent_events(db, session_id, limit=20, owner_mid=owner_mid)
    personal_profiles = {
        "beauty": await get_personal_profile(db, session_id, "beauty", owner_mid=owner_mid),
    }

    return {
        "compiled_videos": compiled_videos,
        "total_compiled": len(compiled_videos),
        "collections": collections,
        "total_collections": len(collections),
        "knowledge_node_count": kn_count,
        "concept_count": concept_count,
        "memory_node_count": mem_count,
        "folders": folders,
        "owner_mid": owner_mid,
        "recent_events": recent_events,
        "personal_profiles": personal_profiles,
    }


@router.post("/demo")
async def login_as_demo(db: AsyncSession = Depends(get_db)):
    """
    演示账号登录 — 无需B站扫码，使用固定演示会话

    返回 session_id 和演示用户信息
    """
    # 使用固定 session_id，确保演示数据（收藏夹/视频）不会丢失
    session_id = "demo_session"

    # 检查是否已存在演示会话
    result = await db.execute(
        select(UserSessionModel).where(UserSessionModel.session_id == session_id)
    )
    existing = result.scalars().first()

    if existing:
        existing.is_valid = True
        existing.last_active_at = datetime.utcnow()
    else:
        db_session = UserSessionModel(
            session_id=session_id,
            bili_mid=0,
            bili_uname="演示用户",
            bili_face="",
            sessdata="",
            bili_jct="",
            dedeuserid="0",
            is_valid=True
        )
        db.add(db_session)

    await _ensure_demo_workspace_seed(db, session_id)
    await record_user_event(
        db,
        session_id,
        "demo_login",
        "进入演示账号",
        "打开演示账号空间，体验灵犀完整功能。",
        owner_mid=0,
    )
    await db.commit()

    # 缓存到内存
    login_sessions[session_id] = {
        "cookies": {},
        "user_info": {
            "mid": 0,
            "uname": "演示用户",
            "face": "",
            "level": 0,
        },
        "is_demo": True,
    }

    return {
        "session_id": session_id,
        "user_info": {
            "mid": 0,
            "uname": "演示用户",
            "face": "",
            "level": 0,
        },
        "is_demo": True,
    }


async def get_session(session_id: str) -> dict:
    """
    获取会话信息（内部使用）
    """
    session = login_sessions.get(session_id)
    if session:
        return session

    async with get_db_context() as db:
        result = await db.execute(
            select(UserSessionModel).where(UserSessionModel.session_id == session_id)
        )
        db_session = result.scalar_one_or_none()
        if not db_session or not db_session.is_valid:
            return None
        session = {
            "cookies": {
                "SESSDATA": db_session.sessdata,
                "bili_jct": db_session.bili_jct,
                "DedeUserID": db_session.dedeuserid,
            },
            "user_info": {
                "mid": db_session.bili_mid,
                "uname": db_session.bili_uname,
                "face": db_session.bili_face,
            },
        }

    if session:
        login_sessions[session_id] = session
    return session
