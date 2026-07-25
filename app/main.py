"""
灵犀 LingXi 知识树学习导航系统

主应用入口
"""
# ChromaDB requires sqlite3 >= 3.35.0; Rocky Linux 9 ships 3.34.1
# Use pysqlite3-binary as drop-in replacement when available
try:
    import pysqlite3
    import sys as _sys
    _sys.modules["sqlite3"] = pysqlite3
except ImportError:
    pass

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from app.config import settings, ensure_directories
from app.database import init_db
from app.routers import auth, favorites, knowledge, chat, collection
from app.routers import tree
from app.routers import search
from app.routers import learning_path
from app.routers import game
from app.routers import srs
from app.routers import compile
from app.routers import evidence
from app.routers import organizer
from app.routers import tts
from app.routers import memory
from app.routers import agent  # Jingyu: 知识智能体
from app.routers import profile  # Jingyu: 学生画像
from app.routers import proactive  # 鸿蒙 Agent 创新赛：主动服务
from app.routers import weather_api  # 天气 API（Open-Meteo免费）
from app.routers import face_analysis  # 面部识别分析
from app.routers import agent_orchestrator  # 灵犀 Agent 编排引擎
from app.routers import system_status


# 配置日志
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.debug else "INFO"
)
logger.add(
    "logs/app.log",
    rotation="10 MB",
    retention="7 days",
    level="DEBUG"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("灵犀 LingXi 知识树学习导航系统启动中...")
    ensure_directories()
    await init_db()
    logger.info("数据库初始化完成")
    
    yield
    
    # 关闭时
    logger.info("应用关闭")


# 创建 FastAPI 应用
app = FastAPI(
    title="灵犀 LingXi — 个人视频知识导航系统",
    description="""
## 项目简介

基于 B站收藏视频自动构建的个人知识树与学习导航系统。

### 核心功能

- **知识树** - 自动从视频内容抽取知识点并构建知识树
- **节点详情** - 查看知识点定义、前置/后续、相关视频片段
- **视频详情** - 查看视频知识点时间线，可追溯到具体秒数
- **学习路径** - 基于图结构推荐学习顺序
- **知识问答** - 基于知识图谱 + 向量检索的辅助问答
- **收藏夹同步** - B站扫码登录，自动同步收藏夹内容

### 技术栈

- FastAPI + LangChain + ChromaDB + networkx
- B站 API (非官方)
    """,
    version="2.0.0",
    lifespan=lifespan
)


# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 注册路由
app.include_router(auth.router)
app.include_router(favorites.router)
app.include_router(knowledge.router)
app.include_router(chat.router)
app.include_router(tree.router)
app.include_router(search.router)
app.include_router(learning_path.router)
app.include_router(game.router)
app.include_router(srs.router)
app.include_router(compile.router)
app.include_router(evidence.router)
app.include_router(collection.router)
app.include_router(organizer.router)
app.include_router(tts.router)
app.include_router(memory.router)
app.include_router(agent.router)   # Jingyu: 知识智能体
app.include_router(profile.router)  # Jingyu: 学生画像
app.include_router(proactive.router)  # 鸿蒙 Agent 创新赛：主动服务
app.include_router(weather_api.router)  # 天气 API
app.include_router(face_analysis.router)  # 面部分析
app.include_router(agent_orchestrator.router)  # Agent 编排引擎
app.include_router(system_status.router)


@app.get("/")
async def root():
    """API 根路径"""
    return {
        "message": "灵犀 LingXi — 个人视频知识导航系统",
        "version": "2.0.0",
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.debug
    )
