"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LearnPageShell from "@/components/LearnPageShell";
import KnowledgeGraph3D from "@/components/KnowledgeGraph3D";
import Link from "next/link";
import {
  learningPathApi,
  LearningPathResponse,
  LearningPathStep,
  PopularTopic,
} from "@/lib/api";
import { useAuthSession } from "@/lib/session";

export default function LearningPathPage() {
  return (
    <Suspense>
      <LearningPathContent />
    </Suspense>
  );
}

function LearningPathContent() {
  const searchParams = useSearchParams();
  const initialTarget = searchParams.get("target") || "";
  const { sessionId, scopeKey } = useAuthSession();

  const [query, setQuery] = useState(initialTarget);
  const [mode, setMode] = useState<"beginner" | "standard" | "quick">("standard");
  const [path, setPath] = useState<LearningPathResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [popularTopics, setPopularTopics] = useState<PopularTopic[]>([]);
  const [focusedStepId, setFocusedStepId] = useState<number | null>(null);

  // 从路径步骤中提取节点 ID 列表（用于 3D 图谱高亮）
  const pathNodeIds = useMemo(() => {
    if (!path) return [];
    return path.steps
      .map((s) => s.node_id)
      .filter((id): id is number => typeof id === "number");
  }, [path]);

  useEffect(() => {
    setPath(null);
    setError("");
    setFocusedStepId(null);
    setLoading(false);
    setPopularTopics([]);
    if (!sessionId) {
      return;
    }
    learningPathApi.getPopularTopics(12).then(setPopularTopics).catch(() => {});
  }, [sessionId, scopeKey]);

  // 如果从知识树页面带了 target 参数，自动生成
  useEffect(() => {
    if (initialTarget && sessionId) {
      handleGenerate(initialTarget);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, scopeKey]);

  const handleGenerate = async (target?: string, modeOverride?: "beginner" | "standard" | "quick") => {
    const t = (target || query).trim();
    if (!t || !sessionId) return;
    setQuery(t);
    setLoading(true);
    setError("");
    setPath(null);
    try {
      const result = await learningPathApi.aiGenerate({ topic: t, mode: modeOverride || mode });
      setPath(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "生成路径失败，请检查是否配置了 DashScope API Key");
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (nextMode: "beginner" | "standard" | "quick") => {
    setMode(nextMode);
    if (path && query.trim() && sessionId) {
      handleGenerate(query, nextMode);
    }
  };

  return (
    <LearnPageShell title="学习路径">
          <div className="app-content" style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
            <div className="learning-path-hero">
              <h2>学习路径规划器</h2>
              <p>输入目标知识点，自动生成从基础到目标的学习路线，每步附带视频证据和可跳转时间片段</p>
            </div>

            {!sessionId && (
              <div className="tree-empty" style={{ marginBottom: 20 }}>
                <p>请先登录后生成当前账号的学习路径</p>
              </div>
            )}

            {/* 输入区 */}
            <div className="path-input-bar">
              <input
                id="learning-target"
                name="target"
                className="search-input"
                style={{ flex: 1 }}
                type="text"
                placeholder="输入目标知识点，如: 机器学习、React Hooks、动态规划..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
              <select
                id="learning-mode"
                name="mode"
                aria-label="选择学习模式"
                className="tree-filter"
                value={mode}
                onChange={(e) => handleModeChange(e.target.value as "beginner" | "standard" | "quick")}
                style={{ padding: "8px 12px" }}
              >
                <option value="beginner">入门路径</option>
                <option value="standard">标准路径</option>
                <option value="quick">快速复习</option>
              </select>
              <button className="btn btn-primary" onClick={() => handleGenerate()} disabled={loading || !query.trim() || !sessionId}>
                {loading ? "生成中..." : "生成路径"}
              </button>
            </div>

            {/* 热门主题 */}
            {!path && popularTopics.length > 0 ? (
              <div className="topics-grid">
                <p style={{ width: "100%", fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>🔥 热门知识点：</p>
                {popularTopics.map((t) => (
                  <button
                    key={t.id}
                    className="topic-chip"
                    onClick={() => { setQuery(t.name); handleGenerate(t.name); }}
                  >
                    {t.name}
                    <small style={{ marginLeft: 4, opacity: 0.6 }}>({t.video_count})</small>
                  </button>
                ))}
              </div>
            ) : !path ? (
              <div className="topics-grid">
                <p style={{ width: "100%", fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  💡 还没有编译数据？试试这些示例：
                </p>
                {[
                  { name: "机器学习", desc: "人工智能核心" },
                  { name: "Linux系统", desc: "服务器基础" },
                  { name: "网络安全", desc: "渗透测试入门" },
                  { name: "数据结构", desc: "编程基石" },
                  { name: "深度学习", desc: "神经网络进阶" },
                  { name: "Docker容器", desc: "应用部署" },
                ].map((t) => (
                  <button
                    key={t.name}
                    className="topic-chip"
                    onClick={() => { setQuery(t.name); handleGenerate(t.name); }}
                    title={t.desc}
                  >
                    {t.name}
                  </button>
                ))}
                <p style={{ width: "100%", fontSize: 12, color: "var(--text-tertiary)", marginTop: 8 }}>
                  ⚠️ 学习路径依赖已编译的视频知识库。请先在 <Link href="/workspace" style={{ color: "var(--link)", textDecoration: "underline" }}>工作台</Link> 编译视频后再生成路径。
                </p>
              </div>
            ) : null}

            {/* 错误 */}
            {error && (
              <div style={{ padding: 12, background: "rgba(220, 38, 38, 0.06)", border: "1px solid rgba(220, 38, 38, 0.2)", borderRadius: "var(--radius)", color: "var(--danger)", marginBottom: 16, fontSize: 14 }}>
                {error}
              </div>
            )}

            {/* 路径结果 */}
            {path && (
              <div className="learning-path-result">
                <div className="path-result-header">
                  <h3>📚 学习路径: {path.target?.name || path.target}</h3>
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    {path.total_steps} 步 · {path.estimated_videos ?? 0} 个视频 · {mode === "beginner" ? "入门" : mode === "quick" ? "快速" : "标准"}模式
                    {path.source === "ai_conceptual" && " · AI 生成"}
                  </span>
                </div>

                {path.summary && typeof path.summary === "string" ? (
                  <div className="path-explanation" style={{ background: "rgba(5,150,105,0.04)", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                    📝 {path.summary}
                  </div>
                ) : path.summary ? (
                  <div className="path-metrics-grid">
                    <div className="path-metric-card">
                      <span className="path-metric-label">路径模式</span>
                      <strong>{path.summary.mode_label}</strong>
                    </div>
                    <div className="path-metric-card">
                      <span className="path-metric-label">平均优先级</span>
                      <strong>{path.summary.avg_priority_score?.toFixed(2) ?? "-"}</strong>
                    </div>
                  </div>
                ) : null}

                {(!path.summary || typeof path.summary === "string") && (
                  <div className="path-explanation" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                    从基础概念出发，逐步递进到「{path.target?.name || query}」。每一步都标注了推荐理由。
                  </div>
                )}

                <div className="path-split-view">
                  <div className="path-steps-panel">
                    <div className="path-steps">
                      {path.steps.map((step, i) => (
                        <PathStepCard
                          key={step.node_id ?? step.step ?? i}
                          step={step}
                          isLast={i === path.steps.length - 1}
                          isFocused={focusedStepId === (step.node_id ?? step.step)}
                          onFocus={() => setFocusedStepId(step.node_id ?? step.step ?? null)}
                        />
                      ))}
                    </div>
                  </div>

                  {pathNodeIds.length > 0 && (
                    <div className="path-graph-panel">
                      <KnowledgeGraph3D
                        sessionId={sessionId}
                        selectedNodeId={focusedStepId}
                        onNodeSelect={(id) => setFocusedStepId(id)}
                        highlightPath={pathNodeIds}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
    </LearnPageShell>
  );
}

function PathStepCard({ step, isLast, isFocused, onFocus }: { step: LearningPathStep; isLast: boolean; isFocused?: boolean; onFocus?: () => void }) {
  const [expanded, setExpanded] = useState(false);

  // 兼容 graph-based 和 AI-generated 两种格式
  const order = step.step ?? step.order ?? 0;
  const name = step.title ?? step.name ?? "";
  const desc = step.description ?? step.definition ?? "";
  const reason = step.reason ?? "";
  const difficulty = step.difficulty ?? 1;
  const nodeId = step.node_id;
  const nodeType = step.node_type ?? "concept";
  const vidCount = step.video_count ?? (step.video ? 1 : 0);
  const isAI = !!step.title;

  return (
    <div className={`path-step${step.is_optional ? " path-step-optional" : ""}${isFocused ? " path-step-focused" : ""}`}>
      <div className="path-step-connector">
        <div className={`path-step-dot${isFocused ? " dot-focused" : ""}`} />
        {!isLast && <div className="path-step-line" />}
      </div>
      <div className="path-step-content" onClick={() => onFocus?.()}>
        <div className="path-step-header" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); onFocus?.(); }}>
          <span className="path-step-order">{order}</span>
          <span className="node-stars" title={`难度: ${difficulty}/5`}>{"●".repeat(difficulty)}{"○".repeat(5 - difficulty)}</span>
          {nodeId ? (
            <Link href={`/node/${nodeId}`} className="path-step-name" onClick={(e) => e.stopPropagation()}>
              {name}
            </Link>
          ) : (
            <span className="path-step-name" style={{ fontWeight: 600 }}>{name}</span>
          )}
          {vidCount > 0 && <span className="node-meta">{vidCount} 视频</span>}
          <span className="path-expand">{expanded ? "▲" : "▼"}</span>
        </div>

        <p className="path-step-reason" style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>💡 {reason}</p>

        {desc && <p className="path-step-definition" style={{ fontSize: 13, marginTop: 4, color: "var(--text-tertiary)" }}>📖 {desc}</p>}

        {/* AI-generated video link */}
        {step.video && (
          <div className="path-step-videos" style={{ marginTop: 8 }}>
            <a
              href={step.video.url || `https://www.bilibili.com/video/${step.video.bvid}`}
              target="_blank" rel="noopener noreferrer"
              className="jump-bilibili-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
                background: "rgba(5,150,105,0.08)", borderRadius: 6, fontSize: 12, color: "var(--link)", textDecoration: "none" }}
            >
              ▶ {step.video.title}
            </a>
          </div>
        )}

        {/* Graph-based videos */}
        {expanded && step.videos && step.videos.length > 0 && (
          <div className="path-step-videos">
            {step.videos.map((v) => (
              <div key={v.bvid} className="video-card-mini">
                <a href={v.url} target="_blank" rel="noopener noreferrer" className="video-card-title">
                  {v.title}
                </a>
                {v.segments && v.segments.length > 0 && (
                  <div className="video-segments-list">
                    {v.segments.map((seg, j) => (
                      <a
                        key={j}
                        href={seg.url || v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="jump-bilibili-btn"
                      >
                        ▶ {seg.time_label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {expanded && (!step.videos || step.videos.length === 0) && (
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>
            暂无关联视频
          </div>
        )}
      </div>
    </div>
  );
}
