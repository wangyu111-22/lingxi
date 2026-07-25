/**
 * API 客户端
 */

import { clearAuthSession, readAuthSession } from "./session";

const LOCAL_FRONTEND_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (
  typeof window !== "undefined" && !LOCAL_FRONTEND_HOSTS.has(window.location.hostname)
    ? "/api/proxy"  // 外网访问时走 Next.js 代理
    : "http://localhost:8000"
);

// 获取 localStorage 中的 session_id
export function getSessionId(): string | null {
    return readAuthSession().sessionId;
}

// 通用请求函数
async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // 30 秒超时，防止请求卡死
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
      });
      clearTimeout(timeoutId);

      // 会话失效时自动清除登录状态并通知导航
      if (response.status === 401) {
          if (typeof window !== "undefined") {
              clearAuthSession();
              window.dispatchEvent(new CustomEvent("lingxi:session-expired"));
          }
          throw new Error("会话已过期，请重新登录");
      }

      if (!response.ok) {
          const error = await response.text();
          throw new Error(error || `请求失败: ${response.status}`);
      }

      return response.json();
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === "AbortError") {
        throw new Error("请求超时（30秒），请检查网络连接");
      }
      throw e;
    }
}

// ==================== 类型定义 ====================

export interface QRCodeResponse {
    qrcode_key: string;
    qrcode_url: string;
    qrcode_image_base64: string;
}

export interface LoginStatusResponse {
    status: "waiting" | "scanned" | "confirmed" | "expired";
    message: string;
    user_info?: UserInfo;
    session_id?: string;
}

export interface UserInfo {
    mid: number;
    uname: string;
    face: string;
    level?: number;
}

export interface CaptchaResponse {
    captcha_id: string;
    question: string;
    expires_in: number;
}

export interface AccountAuthResponse {
    session_id: string;
    user_info: UserInfo;
    is_new_user?: boolean;
}

export interface RestoreStateResponse {
    compiled_videos: CompiledVideoItem[];
    total_compiled: number;
    collections: { bvid: string; title: string; created_at: string }[];
    total_collections: number;
    knowledge_node_count: number;
    concept_count: number;
    memory_node_count: number;
    folders: { media_id: number; title: string; media_count: number }[];
    owner_mid: number | null;
}

export interface CompiledVideoItem {
    bvid: string;
    title: string;
    duration?: number;
    owner_name?: string;
    pic_url?: string;
    extraction_status?: string;
    knowledge_node_count?: number;
    content_category?: string;
    series_name?: string;
    series_key?: string;
    pages_count?: number;
    is_processed?: boolean;
    updated_at?: string;
}

export interface FavoriteFolder {
    media_id: number;
    title: string;
    media_count: number;
    is_selected: boolean;
    is_default?: boolean;
}

export interface Video {
    bvid: string;
    title: string;
    cover?: string;
    duration?: number;
    owner?: string;
    play_count?: number;
    intro?: string;
    is_selected: boolean;
    content_category?: string;  // course / single_video / short_video / series
    series_name?: string;
}

export interface FavoriteVideosResponse {
    folder_info: Record<string, unknown>;
    videos: Video[];
    has_more: boolean;
    page: number;
    page_size: number;
}

export interface OrganizePreviewItem {
    bvid: string;
    title: string;
    resource_id: number;
    resource_type: number;
    target_folder_id: number | null;
    target_folder_title: string;
    reason?: string;
}

export interface OrganizePreviewResponse {
    default_folder_id: number;
    default_folder_title: string;
    folders: FavoriteFolder[];
    items: OrganizePreviewItem[];
    stats: {
        total: number;
        matched: number;
        unmatched: number;
    };
}

export interface BuildRequest {
    folder_ids: number[];
    exclude_bvids?: string[];
}

export interface BuildStatus {
    task_id: string;
    status: "pending" | "running" | "completed" | "failed";
    progress: number;
    current_step: string;
    total_videos: number;
    processed_videos: number;
    message: string;
}

export interface FolderStatus {
    media_id: number;
    indexed_count: number;
    media_count?: number;
    last_sync_at?: string;
}

export interface SyncRequest {
    folder_ids?: number[];
}

export interface SyncResult {
    folder_id: number;
    total: number;
    added: number;
    removed: number;
    indexed: number;
    message: string;
    last_sync_at: string;
}

export interface KnowledgeStats {
    total_chunks: number;
    total_videos: number;
    collection_name: string;
}

export interface ChatResponse {
    answer: string;
    sources: Array<{
        bvid: string;
        title: string;
        url: string;
    }>;
}

export interface ImportUrlRequest {
    url: string;
    session_id?: string;
}

export interface ImportUrlResponse {
    source_id: string;
    source_type: string;
    title: string;
    content_length: number;
    segment_count: number;
    node_count: number;
}

export interface AgentAction {
    type: string;
    label: string;
    target: string;
}

export interface ProactiveCard {
    id: string;
    title: string;
    description: string;
    trigger: string;
    action_label: string;
    target: string;
}

export interface TodayAgentResponse {
    greeting: string;
    context: Record<string, string>;
    profile: {
        goal: string;
        preference: string;
        weak_points: string[];
        best_time: string;
    };
    cards: ProactiveCard[];
    actions: AgentAction[];
}

export interface IntentResponse {
    intent: string;
    utterance: string;
    reply: string;
    context: Record<string, unknown>;
    actions: AgentAction[];
}

// ==================== API 函数 ====================

// 认证相关
export const authApi = {
    // 获取注册验证码（当前为算术验证码，后续可替换短信验证码）
    getCaptcha: () => request<CaptchaResponse>("/auth/captcha"),

    // 手机号注册
    register: (data: { phone: string; username: string; password: string; captcha_id: string; captcha_answer: string }) =>
        request<AccountAuthResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // 手机号 + 密码登录
    login: (data: { phone: string; password: string }) =>
        request<AccountAuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    // 获取登录二维码
    getQRCode: () => request<QRCodeResponse>("/auth/qrcode"),

    // 轮询登录状态
    pollQRCode: (qrcodeKey: string) =>
        request<LoginStatusResponse>(`/auth/qrcode/poll/${qrcodeKey}`),

    // 获取会话信息
    getSession: (sessionId: string) =>
        request<{ valid: boolean; user_info: UserInfo }>(`/auth/session/${sessionId}`),

    // 退出登录
    logout: (sessionId: string) =>
        request(`/auth/session/${sessionId}`, { method: "DELETE" }),

    // 演示账号登录（无需B站扫码）
    loginAsDemo: () =>
        request<{ session_id: string; user_info: UserInfo; is_demo: boolean }>("/auth/demo", { method: "POST" }),

    // 恢复用户历史状态（编译视频、收藏、记忆等）
    restoreState: (sessionId: string) =>
        request<RestoreStateResponse>(`/auth/restore-state?session_id=${sessionId}`),
};

// 收藏夹相关
export const favoritesApi = {
    // 获取收藏夹列表
    getList: (sessionId: string) =>
        request<FavoriteFolder[]>(`/favorites/list?session_id=${sessionId}`),

    // 获取收藏夹视频（分页）
    getVideos: (mediaId: number, sessionId: string, page = 1) =>
        request<FavoriteVideosResponse>(
            `/favorites/${mediaId}/videos?session_id=${sessionId}&page=${page}`
        ),

    // 获取收藏夹全部视频
    getAllVideos: (mediaId: number, sessionId: string) =>
        request<{ total: number; videos: Video[] }>(
            `/favorites/${mediaId}/all-videos?session_id=${sessionId}`
        ),

    // 预览整理
    organizePreview: (folderId: number, sessionId: string) =>
        request<OrganizePreviewResponse>(
            `/favorites/organize/preview?session_id=${sessionId}`,
            {
                method: "POST",
                body: JSON.stringify({ folder_id: folderId }),
            }
        ),

    // 执行整理
    organizeExecute: (
        data: {
            default_folder_id: number;
            moves: Array<{ resource_id: number; resource_type: number; target_folder_id: number }>;
        },
        sessionId: string
    ) =>
        request<{ message: string; moved: number; groups: number }>(
            `/favorites/organize/execute?session_id=${sessionId}`,
            {
                method: "POST",
                body: JSON.stringify(data),
            }
        ),

    // 清理失效内容
    cleanInvalid: (folderId: number, sessionId: string) =>
        request<{ message: string; data: Record<string, unknown> }>(
            `/favorites/organize/clean-invalid?session_id=${sessionId}`,
            {
                method: "POST",
                body: JSON.stringify({ folder_id: folderId }),
            }
        ),
};

// 知识库相关
export const knowledgeApi = {
    // 获取统计信息
    getStats: () => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        return request<KnowledgeStats>(`/knowledge/stats?${params.toString()}`);
    },

    // 构建知识库
    build: (data: BuildRequest, sessionId: string) =>
        request<{ task_id: string; message: string }>(
            `/knowledge/build?session_id=${sessionId}`,
            {
                method: "POST",
                body: JSON.stringify(data),
            }
        ),

    // 获取构建状态
    getBuildStatus: (taskId: string, sessionId?: string) => {
        const params = new URLSearchParams();
        const sid = sessionId || getSessionId();
        if (sid) params.set("session_id", sid);
        return request<BuildStatus>(`/knowledge/build/status/${taskId}?${params.toString()}`);
    },

    // 获取收藏夹入库状态
    getFolderStatus: (sessionId: string) =>
        request<FolderStatus[]>(`/knowledge/folders/status?session_id=${sessionId}`),

    // 同步收藏夹到向量库
    syncFolders: (data: SyncRequest, sessionId: string) =>
        request<SyncResult[]>(
            `/knowledge/folders/sync?session_id=${sessionId}`,
            {
                method: "POST",
                body: JSON.stringify(data),
            }
        ),

    // 清空知识库
    clear: () => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        return request<{ message: string }>(`/knowledge/clear?${params.toString()}`, { method: "DELETE" });
    },

    // 删除视频
    deleteVideo: (bvid: string) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        return request<{ message: string }>(`/knowledge/video/${bvid}?${params.toString()}`, { method: "DELETE" });
    },

    // URL 导入（跨平台）
    importUrl: (url: string, sessionId?: string) =>
        request<ImportUrlResponse>("/knowledge/import-url", {
            method: "POST",
            body: JSON.stringify({ url, session_id: sessionId }),
        }),
};

// 主动服务 Agent 相关
export const proactiveApi = {
    getToday: (sessionId?: string) => {
        const params = new URLSearchParams();
        const sid = sessionId || getSessionId();
        if (sid) params.set("session_id", sid);
        const query = params.toString();
        return request<TodayAgentResponse>(`/proactive/today${query ? `?${query}` : ""}`);
    },

    resolveIntent: (payload: { utterance: string; session_id?: string; context?: Record<string, unknown> }) =>
        request<IntentResponse>("/proactive/intent", {
            method: "POST",
            body: JSON.stringify(payload),
        }),
};

// 对话相关
export const chatApi = {
    // 提问
    ask: (question: string, sessionId?: string, folderIds?: number[]) =>
        request<ChatResponse>("/chat/ask", {
            method: "POST",
            body: JSON.stringify({ question, session_id: sessionId, folder_ids: folderIds }),
        }),

    // 搜索
    search: (query: string, k = 5) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("query", query);
        params.set("k", String(k));
        return request<{ results: Array<{ bvid: string; title: string; url: string; content_preview: string }> }>(
            `/chat/search?${params.toString()}`,
            { method: "POST" }
        );
    },
};

// ==================== 知识树类型 ====================

export interface TreeNode {
    id: number;
    name: string;
    node_type: string;
    difficulty: number;
    definition?: string;
    normalized_name?: string;
    video_count: number;
    node_count: number;
    confidence: number;
    source_count?: number;
    is_reference: boolean;
    // 记忆系统字段
    memory_layer?: "working" | "short_term" | "long_term";
    memory_strength?: number;
    recall_count?: number;
    stability?: number;
    children: TreeNode[];
}

export interface TreeResponse {
    tree: TreeNode[];
    stats: {
        total_topics: number;
        total_nodes: number;
        total_edges: number;
        low_confidence_count: number;
    };
}

// ==================== 3D 图谱类型 ====================

export interface GraphNode {
    id: number;
    name: string;
    node_type: string;
    difficulty: number;
    confidence: number;
    source_count: number;
    definition: string;
    grade: string;
    val: number;
    community_id?: number;
}

export interface GraphLink {
    source: number;
    target: number;
    relation_type: string;
    weight: number;
    confidence: number;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
    stats: {
        node_count: number;
        link_count: number;
    };
}

export interface SegmentRef {
    id: number;
    start_time?: number;
    end_time?: number;
    text: string;
    time_label: string;
}

export interface NodeDetail {
    id: number;
    name: string;
    node_type: string;
    definition?: string;
    difficulty: number;
    confidence: number;
    source_count: number;
    review_status: string;
    aliases: string[];
    main_topic?: { id: number; name: string };
    related_topics: Array<{ id: number; name: string }>;
    prerequisites: Array<{ id: number; name: string; difficulty: number }>;
    successors: Array<{ id: number; name: string; difficulty: number }>;
    related_nodes: Array<{ id: number; name: string; node_type: string }>;
    videos: Array<{
        bvid: string;
        title: string;
        owner_name?: string;
        pic_url?: string;
        duration?: number;
        evidence_score?: number;
        url: string;
        segments: Array<{
            start_time?: number;
            end_time?: number;
            text: string;
            time_label: string;
            match_confidence?: number;
            confidence_level?: "high" | "medium" | "low";
            match_reason?: string;
        }>;
    }>;
    tree_position: Array<{ id: number; name: string; type: string }>;
}

export interface VideoDetail {
    bvid: string;
    title: string;
    description?: string;
    owner_name?: string;
    duration?: number;
    pic_url?: string;
    summary?: string;
    tags: string[];
    url: string;
    knowledge_nodes: Array<{
        id: number;
        name: string;
        node_type: string;
        difficulty: number;
        definition?: string;
        confidence: number;
        segments: Array<{ start_time?: number; end_time?: number; time_label: string }>;
        tree_position: Array<{ id: number; name: string; type: string }>;
    }>;
    segments: Array<{
        id: number;
        segment_index: number;
        start_time?: number;
        end_time?: number;
        text: string;
        summary?: string;
        source_type?: string;
        time_label: string;
    }>;
}

export interface TreeStats {
    total_nodes: number;
    total_edges: number;
    total_segments: number;
    total_topics: number;
    total_videos: number;
    pending_review: number;
}

// ==================== 知识树 API ====================

export const treeApi = {
    getTree: (opts?: { minConfidence?: number; topicId?: number; stage?: string; sessionId?: string | null }) => {
        const params = new URLSearchParams();
        const sid = opts?.sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        if (opts?.minConfidence) params.set("min_confidence", String(opts.minConfidence));
        if (opts?.topicId) params.set("topic_id", String(opts.topicId));
        if (opts?.stage) params.set("stage", opts.stage);
        return request<TreeResponse>(`/tree?${params.toString()}`);
    },

    getGraph: (opts?: { topicId?: number; minConfidence?: number; sessionId?: string | null; limit?: number; offset?: number }) => {
        const params = new URLSearchParams();
        const sid = opts?.sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        if (opts?.topicId) params.set("topic_id", String(opts.topicId));
        if (opts?.minConfidence) params.set("min_confidence", String(opts.minConfidence));
        if (opts?.limit) params.set("limit", String(opts.limit));
        if (opts?.offset) params.set("offset", String(opts.offset));
        return request<GraphData>(`/tree/graph?${params.toString()}`);
    },

    getTopics: (sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        return request<Array<{ id: number; name: string; definition?: string; difficulty: number; source_count: number; confidence: number }>>(`/tree/topics?${params.toString()}`);
    },

    getNodeDetail: (nodeId: number, sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        return request<NodeDetail>(`/tree/node/${nodeId}?${params.toString()}`);
    },

    getVideoDetail: (bvid: string, sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        return request<VideoDetail>(`/tree/video/${bvid}?${params.toString()}`);
    },

    getNodeSegments: (nodeId: number, sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        return request<Array<SegmentRef & { video_bvid: string; url?: string }>>(`/tree/node/${nodeId}/segments?${params.toString()}`);
    },

    getStats: (sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        return request<TreeStats>(`/tree/stats?${params.toString()}`);
    },

    getPending: (limit = 50) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("limit", String(limit));
        return request<Array<{ id: number; name: string; node_type: string; definition?: string; confidence: number; source_count: number }>>(`/tree/pending?${params.toString()}`);
    },

    reviewNode: (nodeId: number, action: "approve" | "reject") => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("action", action);
        return request<{ message: string; review_status: string }>(`/tree/node/${nodeId}/review?${params.toString()}`, { method: "POST" });
    },

    getLearningPath: (nodeId: number, mode: "beginner" | "standard" | "quick" = "standard", knownIds?: number[]) => {
        const params = new URLSearchParams({ mode });
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        if (knownIds && knownIds.length > 0) params.set("known", knownIds.join(","));
        return request<LearningPathResponse>(`/tree/node/${nodeId}/path?${params.toString()}`);
    },
};

// ==================== 学习路径类型 ====================

export interface LearningPathStep {
    // Graph-based fields
    order?: number;
    node_id?: number;
    name?: string;
    node_type?: string;
    difficulty?: number;
    definition?: string;
    confidence?: number;
    reason?: string;
    is_optional?: boolean;
    has_videos?: boolean;
    priority_score?: number;
    support_score?: number;
    dependency_depth?: number;
    dependency_role?: string;
    reason_tags?: string[];
    video_count?: number;
    segment_count?: number;
    evidence_score?: number;
    composite_score?: number;
    support_label?: "strong" | "medium" | "weak";
    videos?: Array<{
        bvid: string;
        title: string;
        url: string;
        segments: Array<{ time_label: string; url?: string }>;
    }>;
    // AI-generated fields
    step?: number;
    title?: string;
    description?: string;
    video?: {
        bvid: string;
        title: string;
        start_time?: number;
        url?: string;
    } | null;
}

export interface LearningPathResponse {
    target: string | { id: number; name: string; node_type: string; difficulty: number };
    mode: string;
    steps: LearningPathStep[];
    total_steps: number;
    estimated_videos: number;
    source?: string;
    summary?: string | {
        mode_label: string;
        avg_priority_score: number;
        avg_support_score: number;
        avg_evidence_score?: number;
        avg_composite_score?: number;
        foundation_steps: number;
        direct_prerequisites: number;
        optional_steps: number;
        strong_support_steps?: number;
    };
}

// ==================== 搜索 API ====================

export interface SearchResults {
    query: string;
    type: string;
    nodes: Array<{
        id: number;
        name: string;
        node_type: string;
        difficulty: number;
        definition?: string;
        confidence: number;
        source_count: number;
        video_count: number;
    }>;
    videos: Array<{
        bvid: string;
        title: string;
        description?: string;
        owner_name?: string;
        duration?: number;
        pic_url?: string;
        knowledge_node_count: number;
        url: string;
    }>;
    segments: Array<{
        bvid: string;
        title: string;
        content_preview: string;
        chunk_index?: number;
        url: string;
    }>;
}

export const searchApi = {
    search: (q: string, type: string = "all", limit: number = 20, sessionId?: string | null) => {
        const params = new URLSearchParams();
        const sid = sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("q", q);
        params.set("type", type);
        params.set("limit", String(limit));
        return request<SearchResults>(`/search?${params.toString()}`);
    },
};

// ==================== 灵犀编译类型 ====================

export interface CompileConcept {
  id: number;
  name: string;
  definition: string;
  difficulty: number;
  claims: CompileClaim[];
}

export interface CompileClaim {
  id: number;
  statement: string;
  type: string;
  confidence: number;
  time: string;
  start_time: number;
  end_time: number;
  raw_text: string;
}

export interface TimelineSegment {
  start: number;
  end: number;
  density: number;
  is_peak: boolean;
  concepts?: string[];
}

export interface CompileResult {
  video: { bvid: string; title: string; duration: number };
  concepts: CompileConcept[];
  timeline: TimelineSegment[];
  prerequisites: Array<{ source: string; target: string; type: string }>;
  stats: { concept_count: number; claim_count: number; peak_count: number; segment_count?: number };
}

export interface EvidenceItem {
  ref: number;
  video_title: string;
  bvid: string;
  time: string;
  start_time: number;
  end_time?: number;
  text: string;
  concept?: string;
  claim?: string;
}

export interface EvidenceAnswer {
  answer: string;
  evidence: EvidenceItem[];
  concept_count: number;
}

export interface OrganizerVideoItem {
  bvid: string;
  title: string;
  owner_name?: string;
  duration?: number;
  pic_url?: string;
  folder_ids: number[];
  folder_titles: string[];
  subject_tags: string[];
  content_type: string;
  difficulty_level: string;
  learning_status: string;
  value_tier: string;
  organize_score: number;
  segment_count: number;
  claim_count: number;
  concept_count: number;
  knowledge_node_count: number;
  confidence: number;
  is_core: boolean;
  reasons: string[];
  series_key?: string | null;
  series_name?: string | null;
  duplicate_candidates: Array<{
    group_id: string;
    similarity: number;
    recommended_keep: boolean;
  }>;
}

export interface OrganizerSeriesGroup {
  series_key: string;
  series_name: string;
  video_count: number;
  coverage_score: number;
  reasons: string[];
  videos: Array<{
    bvid: string;
    title: string;
    organize_score: number;
    difficulty_level: string;
  }>;
}

export interface OrganizerDuplicateGroup {
  group_id: string;
  reason: string;
  recommended_keep_bvid: string;
  archive_candidates: string[];
  items: Array<{
    bvid: string;
    title: string;
    similarity: number;
    organize_score: number;
  }>;
}

export interface OrganizerSuggestion {
  type: string;
  title: string;
  description: string;
  targets: string[];
  confidence: number;
  evidence: string[];
}

export interface OrganizerReport {
  summary: {
    total_videos: number;
    series_count: number;
    duplicate_group_count: number;
    core_count: number;
    low_value_count: number;
    compiled_count: number;
  };
  videos: OrganizerVideoItem[];
  series_groups: OrganizerSeriesGroup[];
  duplicate_groups: OrganizerDuplicateGroup[];
  suggestions: OrganizerSuggestion[];
  facet_counts: {
    subject_tags: Record<string, number>;
    content_type: Record<string, number>;
    difficulty_level: Record<string, number>;
    learning_status: Record<string, number>;
    value_tier: Record<string, number>;
  };
  export_generated_at: string;
}

// ==================== Agent 类型 ====================

export interface AgentStep {
  tool: string;
  input: string;
  output: string;
}

export interface AgentCitation {
  bvid: string;
  title: string;
  time: string;
  text: string;
}

export interface AgentAnswer {
  answer: string;
  steps: AgentStep[];
  citations: AgentCitation[];
}

export const agentApi = {
  ask: (question: string, sessionId?: string | null) =>
    request<AgentAnswer>("/agent/ask", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId }),
    }),
};


// ==================== 灵犀编译 API ====================

export interface VideoPageInfo {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

export interface VideoPagesResponse {
  bvid: string;
  title: string;
  total_duration: number;
  pages_count: number;
  pages: VideoPageInfo[];
}

export const compileApi = {
  compileVideo: (bvid: string, sessionId: string, cid?: number, pageTitle?: string) =>
    request<{ task_id: string; message: string }>("/compile/video", {
      method: "POST",
      body: JSON.stringify({ bvid, session_id: sessionId, cid, page_title: pageTitle }),
    }),
  getVideoPages: (bvid: string) => {
    const params = new URLSearchParams();
    const sid = getSessionId();
    if (sid) params.set("session_id", sid);
    return request<VideoPagesResponse>(`/compile/pages/${bvid}?${params.toString()}`);
  },
  getStatus: (taskId: string, sessionId?: string) => {
    const params = new URLSearchParams();
    const sid = sessionId || getSessionId();
    if (sid) params.set("session_id", sid);
    return request<{ status: string; progress: number; message: string }>(`/compile/status/${taskId}?${params.toString()}`);
  },
  getResult: (bvid: string, pageCid?: number, sessionId?: string | null) => {
    const params = new URLSearchParams();
    const sid = sessionId ?? getSessionId();
    if (sid) params.set("session_id", sid);
    if (pageCid != null) params.set("page_cid", String(pageCid));
    params.set("_t", String(Date.now()));
    return request<CompileResult>(`/compile/result/${bvid}?${params.toString()}`);
  },
};

export const evidenceApi = {
  ask: (question: string, sessionId?: string | null) =>
    request<EvidenceAnswer>("/evidence/ask", {
      method: "POST",
      body: JSON.stringify({ question, session_id: sessionId }),
    }),
};

export const organizerApi = {
  getReport: (sessionId: string, folderIds?: number[]) => {
    const params = new URLSearchParams({ session_id: sessionId });
    if (folderIds && folderIds.length > 0) {
      params.set("folder_ids", folderIds.join(","));
    }
    return request<OrganizerReport>(`/organizer/report?${params.toString()}`);
  },
  getExportUrl: (sessionId: string, format: "json" | "markdown" = "json") => {
    const params = new URLSearchParams({ session_id: sessionId, format });
    return `${API_BASE_URL}/organizer/export?${params.toString()}`;
  },
};

// ==================== 学生画像类型 ====================

export interface ProfileDimension {
  label: string;
  score: number;
  level: string;
  label_cn: string;
  detail: Record<string, any>;
}

export interface EvaluationReport {
  profile: ProfileData;
  weak_concepts: { node_id: number; name: string; easiness_factor: number; interval_days: number; repetitions: number; url: string }[];
  weak_count: number;
  recommendations: { area: string; advice: string; action: string; link: string }[];
  trend: string;
  trend_label: string;
  evaluation_summary: Record<string, any>;
}

export interface ProfileData {
  owner_mid: number | null;
  composite_score: number;
  composite_level: string;
  composite_label: string;
  dimensions: Record<string, ProfileDimension>;
  radar: { labels: string[]; values: number[] };
}

export const profileApi = {
  get: (sessionId: string) =>
    request<ProfileData>(`/api/profile?session_id=${sessionId}`),
  dialog: (message: string, sessionId: string) =>
    request<{ response: string; profile: ProfileData; suggestions: string[] }>(
      "/api/profile/dialog",
      {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, message }),
      }
    ),
  evaluation: (sessionId: string) =>
    request<EvaluationReport>(`/api/profile/evaluation/report?session_id=${sessionId}`),
};

export const collectionApi = {
  toggle: (bvid: string, title: string, sessionId: string) =>
    request<{ hearted: boolean; bvid: string }>("/collection/toggle", {
      method: "POST",
      body: JSON.stringify({ bvid, title, session_id: sessionId }),
    }),
  list: (sessionId: string) =>
    request<{ bvid: string; title: string; created_at: string }[]>(`/collection/list?session_id=${sessionId}`),
  clearTree: (sessionId: string) =>
    request<{ message: string; deleted_nodes: number; deleted_edges: number; deleted_links: number }>(
      `/collection/clear-tree?session_id=${sessionId}`,
      { method: "POST" }
    ),
};

// ==================== 记忆系统类型 ====================

export interface MemoryStats {
    total_nodes: number;
    working_count: number;
    short_term_count: number;
    long_term_count: number;
    episodic_count: number;
    semantic_count: number;
    procedural_count: number;
    total_evidences: number;
    avg_strength_working: number;
    avg_strength_short_term: number;
    avg_strength_long_term: number;
}

export interface MemoryRetrievalResult {
    node_id: number;
    name: string;
    content: string;
    memory_type: string;
    memory_layer: string;
    strength: number;
    relevance_score: number;
    context_boost: number;
    freshness_boost: number;
    evidence_count: number;
    evidences: Array<{
        source_type: string;
        source_id: string;
        source_title: string;
        segment_id?: number;
        start_time?: number;
        end_time?: number;
        text_snippet: string;
        confidence: number;
    }>;
}

export interface MemorySearchResponse {
    query: string;
    results: MemoryRetrievalResult[];
    total_found: number;
    retrieval_time_ms: number;
}

export interface MemoryDecayCheck {
    total: number;
    forgotten_count: number;
    needs_review_count: number;
    stable_count: number;
    forgotten: Array<{ id: number; name: string; strength: number }>;
    needs_review: Array<{ id: number; name: string; strength: number }>;
}

export interface TreeMemorySummary {
    tree_stats: {
        total_topics: number;
        total_nodes: number;
        total_edges: number;
        low_confidence_count: number;
    };
    memory_summary: {
        total_nodes: number;
        working: number;
        short_term: number;
        long_term: number;
        avg_strength: number;
        needs_review: number;
        strong: number;
    };
}

// ==================== 记忆系统 API ====================

export const memoryApi = {
    getStats: (ownerMid?: number) => {
        const params = new URLSearchParams();
        if (ownerMid) params.set("owner_mid", String(ownerMid));
        return request<MemoryStats>(`/api/memory/stats?${params.toString()}`);
    },

    search: (opts: {
        query: string;
        top_k?: number;
        context_node_ids?: number[];
        min_strength?: number;
        include_evidences?: boolean;
    }) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("owner_mid", sid);
        return request<MemorySearchResponse>("/api/memory/search", {
            method: "POST",
            body: JSON.stringify({
                query: opts.query,
                top_k: opts.top_k ?? 10,
                context_node_ids: opts.context_node_ids ?? [],
                min_strength: opts.min_strength ?? 0.2,
                include_evidences: opts.include_evidences ?? true,
            }),
        });
    },

    recordRecall: (nodeId: number) =>
        request<{ node_id: number; new_strength: number; message: string }>(
            `/api/memory/recall/${nodeId}`, { method: "POST" }
        ),

    checkDecay: () => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("owner_mid", sid);
        return request<MemoryDecayCheck>(`/api/memory/decay-check?${params.toString()}`, {
            method: "POST",
        });
    },

    syncFromKnowledge: () => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("owner_mid", sid);
        return request<{ message: string; created: number; skipped: number }>(
            `/api/memory/sync-from-knowledge?${params.toString()}`, { method: "POST" }
        );
    },
};

// 知识树记忆相关 API (扩展 treeApi)
export const treeMemoryApi = {
    getTreeByMemoryLayer: (layer: "working" | "short_term" | "long_term", opts?: {
        minConfidence?: number;
        sessionId?: string | null;
    }) => {
        const params = new URLSearchParams({ layer });
        const sid = opts?.sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        if (opts?.minConfidence) params.set("min_confidence", String(opts.minConfidence));
        return request<TreeResponse>(`/tree/memory-layer?${params.toString()}`);
    },

    getMemorySummary: (opts?: { minConfidence?: number; sessionId?: string | null }) => {
        const params = new URLSearchParams();
        const sid = opts?.sessionId ?? getSessionId();
        if (sid) params.set("session_id", sid);
        if (opts?.minConfidence) params.set("min_confidence", String(opts.minConfidence));
        return request<TreeMemorySummary>(`/tree/memory-summary?${params.toString()}`);
    },
};

export interface PopularTopic {
    id: number;
    name: string;
    node_type: string;
    difficulty: number;
    definition?: string;
    source_count: number;
    video_count: number;
}

export const learningPathApi = {
    // 搜索学习目标
    searchTargets: (q: string, limit = 10) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("q", q);
        params.set("limit", String(limit));
        return request<Array<{ id: number; name: string; node_type: string; difficulty: number; definition?: string; confidence: number; source_count: number }>>(
            `/learning-path/search?${params.toString()}`
        );
    },

    // 生成学习路径
    generate: (opts: { target?: string; nodeId?: number; mode?: string; known?: number[] }) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        if (opts.target) params.set("target", opts.target);
        if (opts.nodeId) params.set("node_id", String(opts.nodeId));
        if (opts.mode) params.set("mode", opts.mode);
        if (opts.known && opts.known.length > 0) params.set("known", opts.known.join(","));
        return request<LearningPathResponse>(`/learning-path/generate?${params.toString()}`);
    },

    // 获取热门学习目标
    getPopularTopics: (limit = 20) => {
        const params = new URLSearchParams();
        const sid = getSessionId();
        if (sid) params.set("session_id", sid);
        params.set("limit", String(limit));
        return request<PopularTopic[]>(`/learning-path/topics?${params.toString()}`);
    },

    // AI 驱动生成学习路径（从视频内容分析编排）
    aiGenerate: (opts: { topic: string; mode?: string }) => {
        const sid = getSessionId();
        return request<LearningPathResponse>(`/learning-path/ai-generate`, {
            method: "POST",
            body: JSON.stringify({
                topic: opts.topic,
                session_id: sid,
                mode: opts.mode || "standard",
            }),
        });
    },
};
