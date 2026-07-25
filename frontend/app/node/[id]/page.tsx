"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { treeApi, NodeDetail, LearningPathResponse } from "@/lib/api";
import ZoneShell from "@/components/ZoneShell";
import { isActiveSession, useAuthSession } from "@/lib/session";

const TYPE_LABELS: Record<string, string> = {
  topic: "主题", concept: "概念", tool: "工具", reference: "参考",
};
const STATUS_LABELS: Record<string, string> = {
  auto: "自动", pending: "待审核", approved: "已通过", rejected: "已拒绝",
};
const MODE_LABELS: Record<string, string> = {
  beginner: "入门", standard: "标准", quick: "快速复习",
};

export default function NodeDetailPage() {
  const params = useParams();
  const nodeId = Number(params.id);
  const { sessionId, scopeKey } = useAuthSession();
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<LearningPathResponse | null>(null);
  const [pathMode, setPathMode] = useState<"beginner" | "standard" | "quick">("standard");
  const [pathLoading, setPathLoading] = useState(false);
  const detailRequestIdRef = useRef(0);
  const pathRequestIdRef = useRef(0);

  useEffect(() => {
    setDetail(null); setPath(null); setPathLoading(false);
    setLoading(!!sessionId && !!nodeId);
    if (!nodeId || !sessionId) { setLoading(false); return; }
    const requestId = ++detailRequestIdRef.current;
    const activeSessionId = sessionId;
    treeApi.getNodeDetail(nodeId, sessionId)
      .then((data) => {
        if (detailRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setDetail(data);
      })
      .catch(() => {
        if (detailRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setDetail(null);
      })
      .finally(() => {
        if (detailRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setLoading(false);
      });
  }, [nodeId, sessionId, scopeKey]);

  if (loading) return <div className="loading-state">加载中...</div>;
  if (!sessionId) return <div className="loading-state">请先登录</div>;
  if (!detail) return <div className="loading-state">节点未找到</div>;

  const stars = Array.from({ length: detail.difficulty }, () => "●").join("");

  return (
    <ZoneShell title="知识节点" icon={<span style={{fontSize:18}}>📚</span>} color="#059669">
          <div className="app-content">
            <Link href="/tree" className="detail-back">← 返回知识树</Link>

            <div className="detail-header">
              <h1>{detail.name}</h1>
              <div className="detail-meta">
                <span className={`node-badge ${detail.node_type}`}>{TYPE_LABELS[detail.node_type] || detail.node_type}</span>
                {detail.difficulty > 0 && <span className="node-stars">{stars}</span>}
                <span>置信度：{(detail.confidence * 100).toFixed(0)}%</span>
                <span>{detail.source_count} 个来源</span>
                <span>状态：{STATUS_LABELS[detail.review_status] || detail.review_status}</span>
              </div>
            </div>

            {detail.definition && (
              <div className="detail-section"><h2>定义</h2><p>{detail.definition}</p></div>
            )}

            {detail.tree_position && detail.tree_position.length > 0 && (
              <div className="detail-section">
                <h2>知识树位置</h2>
                <div className="breadcrumb">
                  {detail.tree_position.map((item, i) => (
                    <span key={item.id}>
                      {i > 0 && <span className="breadcrumb-sep"> &gt; </span>}
                      <Link href={`/node/${item.id}`}>{item.name}</Link>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.main_topic && (
              <div className="detail-section">
                <h2>所属主题</h2>
                <Link href={`/node/${detail.main_topic.id}`} className="node-link">{detail.main_topic.name}</Link>
              </div>
            )}

            {detail.related_topics.length > 0 && (
              <div className="detail-section">
                <h2>相关主题</h2>
                <div className="node-link-list">
                  {detail.related_topics.map((t) => (
                    <Link key={t.id} href={`/node/${t.id}`} className="node-link">{t.name}</Link>
                  ))}
                </div>
              </div>
            )}

            {detail.prerequisites.length > 0 && (
              <div className="detail-section">
                <h2>前置知识</h2>
                <div className="node-link-list">
                  {detail.prerequisites.map((n) => (
                    <Link key={n.id} href={`/node/${n.id}`} className="node-link">{n.name}</Link>
                  ))}
                </div>
              </div>
            )}

            {detail.successors.length > 0 && (
              <div className="detail-section">
                <h2>后续知识</h2>
                <div className="node-link-list">
                  {detail.successors.map((n) => (
                    <Link key={n.id} href={`/node/${n.id}`} className="node-link">{n.name}</Link>
                  ))}
                </div>
              </div>
            )}

            {detail.related_nodes.length > 0 && (
              <div className="detail-section">
                <h2>相关节点</h2>
                <div className="node-link-list">
                  {detail.related_nodes.map((n) => (
                    <Link key={n.id} href={`/node/${n.id}`} className="node-link">
                      <span className={`node-badge ${n.node_type}`}>{TYPE_LABELS[n.node_type] || n.node_type}</span>
                      {n.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {detail.videos.length > 0 && (
              <div className="detail-section">
                <h2>相关视频</h2>
                {detail.videos.map((v) => (
                  <div key={v.bvid} className="video-card">
                    <Link href={`/video/${v.bvid}`} className="video-card-title">{v.title}</Link>
                    {v.owner_name && <div className="video-card-meta">UP主：{v.owner_name}</div>}
                    <div style={{ marginTop: 10, marginBottom: v.segments.length > 0 ? 10 : 0 }}>
                      <a
                        href={`${v.url || `https://www.bilibili.com/video/${v.bvid}`}${v.segments[0]?.start_time ? `?t=${Math.floor(v.segments[0].start_time || 0)}` : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-bilibili"
                      >
                        ▶ 前往B站看视频
                      </a>
                    </div>
                    {v.segments.map((seg, i) => (
                      <div key={i} className="segment-item">
                        <span className="segment-time">
                          {seg.time_label ? (
                            <a href={`${v.url}?t=${Math.floor(seg.start_time || 0)}`} target="_blank" rel="noopener noreferrer">{seg.time_label}</a>
                          ) : "--:--"}
                        </span>
                        <span className="segment-text">{seg.text}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="detail-section">
              <h2>学习路径</h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {(["beginner", "standard", "quick"] as const).map((m) => (
                  <button key={m}
                    className={`btn ${pathMode === m ? "btn-primary" : "btn-outline"}`}
                    style={{ fontSize: 13, padding: "6px 12px" }}
                    onClick={() => {
                      setPathMode(m); setPath(null); setPathLoading(true);
                      const requestId = ++pathRequestIdRef.current;
                      const activeSessionId = sessionId;
                      treeApi.getLearningPath(nodeId, m)
                        .then((data) => {
                          if (pathRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setPath(data);
                        })
                        .catch(() => {
                          if (pathRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setPath(null);
                        })
                        .finally(() => {
                          if (pathRequestIdRef.current === requestId && isActiveSession(activeSessionId)) setPathLoading(false);
                        });
                    }}
                  >{MODE_LABELS[m]}</button>
                ))}
              </div>
              {pathLoading && <div className="loading-state">生成路径中...</div>}
              {path && !pathLoading && (
                <div className="path-steps">
                  {path.steps.length === 0 ? (
                    <p style={{ color: "#6b6560", fontSize: 13 }}>无需前置知识，可以直接学习。</p>
                  ) : (
                    path.steps.map((step) => (
                      <div key={step.order} className="path-step" style={{
                        display: "flex", gap: 12, padding: "10px 0",
                        borderBottom: "1px solid rgba(0,0,0,0.06)", opacity: step.is_optional ? 0.7 : 1,
                      }}>
                        <span style={{ fontWeight: 600, color: "#d98b2b", minWidth: 24 }}>{step.order}</span>
                        <div style={{ flex: 1 }}>
                          <Link href={`/node/${step.node_id}`} className="kp-name">{step.name}</Link>
                          <span className={`node-badge ${step.node_type ?? "concept"}`} style={{ marginLeft: 8 }}>{TYPE_LABELS[step.node_type ?? "concept"] || step.node_type || "概念"}</span>
                          <span className="node-stars" style={{ marginLeft: 6 }}>
                            {Array.from({ length: step.difficulty ?? 1 }, () => "●").join("")}
                          </span>
                          {step.is_optional && <span className="node-meta" style={{ marginLeft: 6 }}>（可选）</span>}
                          <div style={{ fontSize: 13, color: "#6b6560", marginTop: 2 }}>{step.reason}</div>
                          {step.videos && step.videos.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {step.videos.map((v) => (
                                <span key={v.bvid} style={{ fontSize: 12, marginRight: 8 }}>
                                  <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2f7c78" }}>{v.title}</a>
                                  {v.segments.map((s, i) => s.url ? (
                                    <a key={i} className="kp-time-badge" href={s.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4 }}>{s.time_label}</a>
                                  ) : null)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {path.total_steps > 0 && (
                    <div style={{ fontSize: 13, color: "#6b6560", marginTop: 8 }}>
                      共 {path.total_steps} 步，{path.estimated_videos} 个视频
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
    </ZoneShell>
  );
}
