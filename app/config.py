"""
LingXiMind 知识树学习导航系统

核心配置模块
"""
from pydantic_settings import BaseSettings
from pydantic import Field, AliasChoices
from typing import Optional
import os


class Settings(BaseSettings):
    """应用配置"""

    # LLM Provider 选择
    llm_provider: str = Field(default="huawei", env="LLM_PROVIDER")  # huawei | dashscope | spark

    # DashScope / OpenAI 兼容 LLM 配置
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("DASHSCOPE_API_KEY", "OPENAI_API_KEY"),
    )
    openai_base_url: str = Field(default="https://api.openai.com/v1", env="OPENAI_BASE_URL")
    llm_model: str = Field(default="gpt-4-turbo", env="LLM_MODEL")
    embedding_model: str = Field(default="text-embedding-3-small", env="EMBEDDING_MODEL")

    # 讯飞星火 Spark 配置
    spark_api_key: str = Field(default="", env="SPARK_API_KEY")
    spark_base_url: str = Field(
        default="https://spark-api-open.xf-yun.com/v2",
        env="SPARK_BASE_URL"
    )
    spark_model: str = Field(default="spark-x", env="SPARK_MODEL")

    # --- 华为盘古大模型 (OpenAI 兼容 V2) ---
    huawei_api_key: str = Field(default="", env="HUAWEI_API_KEY")
    huawei_base_url: str = Field(
        default="https://infer-api.ap-southeast-1.myhuaweicloud.com",
        env="HUAWEI_BASE_URL"
    )
    huawei_model: str = Field(default="pangu-nlp-n1-32k", env="HUAWEI_MODEL")

    # --- 华为云 IAM 认证 ---
    huawei_iam_endpoint: str = Field(
        default="https://iam.ap-southeast-1.myhuaweicloud.com",
        env="HUAWEI_IAM_ENDPOINT"
    )
    huawei_project_id: str = Field(default="", env="HUAWEI_PROJECT_ID")
    huawei_ak: str = Field(default="", env="HUAWEI_AK")
    huawei_sk: str = Field(default="", env="HUAWEI_SK")

    # --- 华为 SIS 语音服务 ---
    huawei_sis_endpoint: str = Field(
        default="https://sis-ext.cn-north-4.myhuaweicloud.com",
        env="HUAWEI_SIS_ENDPOINT"
    )

    # --- 华为 Embedding 部署 ---
    huawei_embedding_deployment_id: str = Field(default="", env="HUAWEI_EMBEDDING_DEPLOYMENT_ID")
    huawei_embedding_model: str = Field(default="Pangu-EmbeddingRank-zh-2.0.3", env="HUAWEI_EMBEDDING_MODEL")

    # DashScope ASR (过渡期备用)
    dashscope_base_url: str = Field(
        default="https://dashscope.aliyuncs.com/api/v1",
        env="DASHSCOPE_BASE_URL"
    )
    asr_model: str = Field(default="paraformer-v2", env="ASR_MODEL")
    asr_timeout: int = Field(default=600, env="ASR_TIMEOUT")
    asr_model_local: str = Field(default="paraformer-realtime-v2", env="ASR_MODEL_LOCAL")
    asr_input_format: str = Field(default="pcm", env="ASR_INPUT_FORMAT")

    # 应用配置
    app_host: str = Field(default="0.0.0.0", env="APP_HOST")
    app_port: int = Field(default=8000, env="APP_PORT")
    debug: bool = Field(default=True, env="DEBUG")

    # 数据库
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/lingxi.db",
        env="DATABASE_URL"
    )

    # ChromaDB
    chroma_persist_directory: str = Field(
        default="./data/chroma_db",
        env="CHROMA_PERSIST_DIRECTORY"
    )

    # 知识图谱
    graph_persist_path: str = Field(
        default="./data/graph.json",
        env="GRAPH_PERSIST_PATH"
    )

    # 知识抽取
    extraction_min_confidence: float = Field(default=0.3, env="EXTRACTION_MIN_CONFIDENCE")
    tree_min_confidence: float = Field(default=0.4, env="TREE_MIN_CONFIDENCE")
    extraction_segment_merge_seconds: float = Field(default=30.0, env="EXTRACTION_SEGMENT_MERGE_SECONDS")
    max_compile_duration: int = Field(default=36000, env="MAX_COMPILE_DURATION")  # 编译时长上限(秒), 默认10h

    # 轻量模型
    ml_artifact_dir: str = Field(default="./data/models", env="MODEL_ARTIFACT_DIR")
    evidence_ranker_model_path: str = Field(default="./data/models/evidence_ranker.json", env="EVIDENCE_RANKER_MODEL_PATH")
    organizer_classifier_model_path: str = Field(default="./data/models/organizer_classifier.json", env="ORGANIZER_CLASSIFIER_MODEL_PATH")
    evidence_ranker_enabled: bool = Field(default=True, env="EVIDENCE_RANKER_ENABLED")
    organizer_classifier_enabled: bool = Field(default=True, env="ORGANIZER_CLASSIFIER_ENABLED")

    # 记忆系统 (Memory System)
    memory_short_term_hours: float = Field(default=24.0, env="MEMORY_SHORT_TERM_HOURS")
    memory_consolidation_threshold: int = Field(default=3, env="MEMORY_CONSOLIDATION_THRESHOLD")
    memory_working_capacity: int = Field(default=7, env="MEMORY_WORKING_CAPACITY")
    memory_decay_base_rate: float = Field(default=0.15, env="MEMORY_DECAY_BASE_RATE")
    memory_semantic_merge_threshold: float = Field(default=0.82, env="MEMORY_SEMANTIC_MERGE_THRESHOLD")
    memory_conflict_threshold: float = Field(default=0.65, env="MEMORY_CONFLICT_THRESHOLD")
    memory_ebbinghaus_enabled: bool = Field(default=True, env="MEMORY_EBBINGHAUS_ENABLED")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# 全局配置实例
settings = Settings()


def ensure_directories():
    """确保必要的目录存在"""
    dirs = [
        "data",
        settings.chroma_persist_directory,
        settings.ml_artifact_dir,
        "logs"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
