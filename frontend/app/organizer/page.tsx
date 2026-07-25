"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LearnPageShell from "@/components/LearnPageShell";
import { favoritesApi, compileApi, collectionApi, FavoriteFolder } from "@/lib/api";
import { isActiveSession, useAuthSession } from "@/lib/session";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="organizer-stat-card">
      <div className="organizer-stat-value">{value}</div>
      <div className="organizer-stat-label">{label}</div>
    </div>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface VideoItem {
  bvid: string;
  title: string;
  duration?: number;
  owner?: string;
  content_category?: string;
  series_name?: string;
  compiled?: boolean;
  conceptCount?: number;
  claimCount?: number;
  segmentCount?: number;
  knowledgeNodeCount?: number;
}

const SUBJECT_TAGS: Record<string, string[]> = {
  "计算机/AI": ["ai", "llm", "大模型", "机器学习", "深度学习", "神经网络", "deepseek", "python", "java", "c++", "c语言", "golang", "c#", "php", "编程", "算法", "数据结构", "代码"],
  "网络安全": ["安全", "ctf", "渗透", "kali", "sql注入", "web安全", "信息安全", "密码学", "misc", "隐写", "流量分析", "黑客"],
  "通信/大唐杯": ["大唐杯", "5g", "ipv6", "ict", "通信", "基站", "云计算", "云模块", "hcia", "hcip", "hcie"],
  "英语": ["英语", "单词", "语法", "听力", "口语", "雅思", "托福", "四六级", "大英赛", "国际音标"],
  "数学": ["数学", "勾股", "建模", "微积分", "线代", "概率"],
  "工具/效率": ["docker", "工具", "效率", "ppt", "知识库", "openclaw", "obsidian", "vscode", "git", "linux"],
  "论文/科研": ["论文", "科研", "nature", "查重", "学术", "实验"],
  "大学/竞赛": ["竞赛", "大创", "保研", "大学", "四级", "六级"],
};

function classifySubject(title: string): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(SUBJECT_TAGS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      tags.push(tag);
    }
  }
  return tags.length > 0 ? tags : ["其他"];
}

function classifyContentType(title: string): string {
  const lower = title.toLowerCase();
  if (/教程|实战|项目|从零|手把手|开发|搭建|案例|入门|基础/.test(lower)) return "教程实战";
  if (/是什么|原理|理解|概念|本质|详解/.test(lower)) return "概念讲解";
  if (/刷题|题解|习题|真题|练习/.test(lower)) return "刷题训练";
  if (/经验|分享|心得|建议|避坑|规划|路线/.test(lower)) return "经验分享";
  if (/资讯|新闻|解读|速递|更新|趋势/.test(lower)) return "资讯解读";
  return "概念讲解";
}

export default function OrganizerPage() {
  const { sessionId, scopeKey } = useAuthSession();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("全部");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [heartedVideos, setHeartedVideos] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);

  // 加载已收藏的视频列表
  useEffect(() => {
    if (sessionId) {
      collectionApi.list(sessionId).then(list => {
        setHeartedVideos(new Set(list.map((v: any) => v.bvid)));
      }).catch(() => {});
    }
  }, [sessionId]);

  // 切换收藏
  const toggleHeart = async (bvid: string, title: string) => {
    if (!sessionId) return;
    setHeartedVideos(prev => {
      const next = new Set(prev);
      next.has(bvid) ? next.delete(bvid) : next.add(bvid);
      return next;
    });
    try {
      await collectionApi.toggle(bvid, title, sessionId);
    } catch {
      setHeartedVideos(prev => {
        const next = new Set(prev);
        next.has(bvid) ? next.delete(bvid) : next.add(bvid);
        return next;
      });
    }
  };

  useEffect(() => {
    setVideos([]);
    setError("");
    setLoading(!!sessionId);
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    const activeSessionId = sessionId;

    // 加载收藏的视频（与工作台相同的数据源）
    favoritesApi
      .getList(sessionId)
      .then(async (folders: FavoriteFolder[]) => {
        if (requestIdRef.current !== requestId || !isActiveSession(activeSessionId)) return;

        const allVideos: VideoItem[] = [];
        const targetFolders = folders.filter((f) => f.is_selected || f.is_default);

        for (const folder of targetFolders) {
          try {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
              const resp = await favoritesApi.getVideos(folder.media_id, sessionId, page);
              for (const v of resp.videos) {
                if (!allVideos.find((av) => av.bvid === v.bvid)) {
                  allVideos.push({
                    bvid: v.bvid,
                    title: v.title,
                    duration: v.duration,
                    owner: v.owner,
                    content_category: (v as any).content_category,
                    series_name: (v as any).series_name,
                  });
                }
              }
              hasMore = resp.has_more;
              page++;
            }
          } catch {
            // 跳过加载失败的文件夹
          }
        }

        if (requestIdRef.current !== requestId || !isActiveSession(activeSessionId)) return;

        // 尝试获取编译状态（非阻塞）
        const enriched = await Promise.all(
          allVideos.slice(0, 50).map(async (video) => {
            try {
              const result = await compileApi.getResult(video.bvid);
              return {
                ...video,
                compiled: true,
                conceptCount: result.stats?.concept_count || 0,
                claimCount: result.stats?.claim_count || 0,
                segmentCount: result.stats?.segment_count || 0,
                knowledgeNodeCount: result.stats?.concept_count || 0,
              };
            } catch {
              return { ...video, compiled: false, conceptCount: 0, claimCount: 0, segmentCount: 0, knowledgeNodeCount: 0 };
            }
          })
        );

        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setVideos(enriched);
        }
      })
      .catch((err) => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setError(err?.message || "加载收藏夹失败");
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId && isActiveSession(activeSessionId)) {
          setLoading(false);
        }
      });
  }, [sessionId, scopeKey]);

  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const tags = classifySubject(video.title);
      if (subjectFilter !== "全部" && !tags.includes(subjectFilter)) return false;
      if (typeFilter !== "全部" && classifyContentType(video.title) !== typeFilter) return false;
      if (query.trim()) {
        const haystack = `${video.title} ${video.owner || ""} ${video.series_name || ""} ${tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [videos, subjectFilter, typeFilter, query]);

  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    videos.forEach(v => classifySubject(v.title).forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [videos]);

  const stats = useMemo(() => ({
    total: videos.length,
    compiled: videos.filter(v => v.compiled).length,
    withConcepts: videos.filter(v => (v.conceptCount || 0) > 0).length,
  }), [videos]);

  return (
    <LearnPageShell title="收藏整理中心">
          <div className="app-content organizer-page">
            <div className="organizer-hero">
              <div>
                <h2>收藏整理分类中心</h2>
                <p>自动分类、识别系列，并给出学习建议。直接来自你的 B站收藏夹。</p>
              </div>
            </div>

            {loading && <div className="loading-state">加载收藏夹中...</div>}
            {!loading && !sessionId && <div className="tree-empty"><p>请先登录后查看整理中心。</p></div>}
            {error && <div className="tree-empty"><p>{error}</p></div>}

            {!loading && sessionId && (
              <>
                <div className="organizer-stats-grid">
                  <StatCard label="总视频" value={stats.total} />
                  <StatCard label="已编译" value={stats.compiled} />
                  <StatCard label="含知识点" value={stats.withConcepts} />
                </div>

                <div className="organizer-filter-bar">
                  <input
                    className="input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索标题 / UP主 / 标签"
                  />
                  <select className="tree-filter" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
                    <option value="全部">全部主题</option>
                    {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select className="tree-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="全部">全部类型</option>
                    <option value="教程实战">教程实战</option>
                    <option value="概念讲解">概念讲解</option>
                    <option value="刷题训练">刷题训练</option>
                    <option value="经验分享">经验分享</option>
                    <option value="资讯解读">资讯解读</option>
                  </select>
                </div>

                {/* 视频列表 — 与工作台相同的数据源 */}
                <div className="organizer-layout">
                  <div className="organizer-main" style={{ maxWidth: "100%" }}>
                    {/* 全量视频列表 */}
                    <section className="organizer-section">
                      <div className="organizer-section-head">
                        <h3>视频总览</h3>
                        <span>{filteredVideos.length} 项</span>
                      </div>
                      {filteredVideos.length === 0 && !loading && (
                        <div className="organizer-empty">没有匹配的视频，试试调整筛选条件</div>
                      )}
                      <div className="organizer-video-list">
                        {filteredVideos.map((video) => {
                          const tags = classifySubject(video.title);
                          const contentType = classifyContentType(video.title);
                          return (
                            <div key={video.bvid} className="organizer-video-card">
                              <div className="organizer-video-top">
                                <div>
                                  <div className="organizer-video-title">
                                    <span
                                      onClick={(e) => { e.stopPropagation(); toggleHeart(video.bvid, video.title); }}
                                      style={{ cursor: "pointer", fontSize: 16, userSelect: "none", marginRight: 6 }}
                                      title={heartedVideos.has(video.bvid) ? "取消收藏" : "加入收藏"}
                                    >
                                      {heartedVideos.has(video.bvid) ? "❤️" : "♡"}
                                    </span>
                                    {video.title}
                                  </div>
                                  <div className="organizer-video-meta">
                                    {video.owner && <span>UP: {video.owner}</span>}
                                    <span>{formatDuration(video.duration)}</span>
                                    {video.compiled && (
                                      <span style={{ color: "var(--primary)" }}>
                                        {(video.conceptCount || 0) > 0 ? `${video.conceptCount} 知识点` : "已编译"}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <a className="btn btn-sm btn-outline" href={`https://www.bilibili.com/video/${video.bvid}`} target="_blank" rel="noopener noreferrer">
                                  查看视频
                                </a>
                              </div>
                              <div className="organizer-tag-row">
                                {tags.map(tag => (
                                  <span key={tag} className={`organizer-chip ${tag === "其他" ? "organizer-chip-ghost" : ""}`}>{tag}</span>
                                ))}
                                <span className="organizer-chip organizer-chip-ghost">{contentType}</span>
                                {video.content_category && (
                                  <span className="organizer-chip organizer-chip-ghost">{video.content_category}</span>
                                )}
                                {video.series_name && (
                                  <span className="organizer-chip" style={{ background: "rgba(var(--primary-rgb,99,102,241),0.12)" }}>📚 {video.series_name}</span>
                                )}
                              </div>
                              <div className="organizer-video-stats">
                                {video.compiled && (
                                  <>
                                    <span>{video.conceptCount || 0} 概念</span>
                                    <span>{video.claimCount || 0} 论断</span>
                                    <span>{video.segmentCount || 0} 片段</span>
                                  </>
                                )}
                                {!video.compiled && <span style={{ color: "var(--text-tertiary)" }}>未编译 — 前往工作台编译</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>
              </>
            )}
          </div>
    </LearnPageShell>
  );
}
