"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import LearnPageShell from "@/components/LearnPageShell";
import { API_BASE_URL } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

const API = API_BASE_URL;

type DueItem = {
  node_id: number;
  name: string;
  definition: string | null;
  node_type: string;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string | null;
  implicit_review: boolean;
};

type ReviewResult = {
  node_id: number;
  easiness_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string | null;
  implicit_reviewed: Array<{ node_id: number; name: string; depth: number }>;
};

type Stats = {
  total_tracked: number;
  due_today: number;
  mastered: number;
  avg_retention: number;
};

type MemoryHistoryItem = {
  node_id?: number;
  concept_name: string;
  memory_layer?: string;
  recall_count?: number;
  confidence?: number;
  updated_at?: string;
};

const REVIEW_ACTIONS = [
  { value: 2, label: "还需复习", hint: "明天再出现", tone: "weak" },
  { value: 4, label: "基本掌握", hint: "拉长间隔", tone: "ok" },
  { value: 5, label: "已经掌握", hint: "进入长期记忆", tone: "good" },
] as const;

function formatDate(value: string | null) {
  if (!value) return "今天";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "今天";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function layerText(layer?: string) {
  if (layer === "long_term") return "长期记忆";
  if (layer === "short_term") return "短期巩固";
  return "新近学习";
}

function isValidReviewItem(item: DueItem) {
  const name = (item.name || "").trim();
  const lower = name.toLowerCase();
  const badExact = new Set(["bye", "hello", "thank", "thanks", "never", "maybe", "can", "like", "yeah", "ok", "okay", "musii"]);
  const badFragments = ["为什么", "怎么", "然后", "这个", "那个", "这里", "那里", "我们", "你们", "其实", "就是", "所以", "但是", "因为", "而这", "大家", "东西", "很有意思", "看起来就像", "我看来就", "不管", "教授", "老师", "讲师", "导师", "博主", "UP主", "作者", "观众", "粉丝"];
  const badStarts = ["只", "也", "但", "而", "这", "那", "就", "你", "我", "他", "她", "它", "可能", "可以", "不能", "哎"];
  if (!name || name.length < 2 || name.length > 32) return false;
  if (/^Node\s+\d+$/i.test(name)) return false;
  if (badExact.has(lower)) return false;
  if (badStarts.some((prefix) => name.startsWith(prefix))) return false;
  if (badFragments.some((fragment) => name.includes(fragment))) return false;
  if (/[的了呢吧吗]$/.test(name)) return false;
  if (/^[a-z]+$/i.test(name) && !/^(ai|api|sql|xss|csrf|ctf|rsa|aes|des|jwt|macd|http|https)$/i.test(name)) return false;
  return true;
}

function reviewDedupeKey(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^[0-9０-９]+[\s._\-、:：]*/, "")
    .replace(/[^0-9a-zA-Z\u4e00-\u9fff]+/g, "");
}

function dedupeReviewItems(items: DueItem[]) {
  const result: DueItem[] = [];
  const keys: string[] = [];
  for (const item of items) {
    const key = reviewDedupeKey(item.name || "");
    if (!key) continue;
    const duplicateIndex = keys.findIndex((existing) => key === existing || key.includes(existing) || existing.includes(key));
    if (duplicateIndex < 0) {
      result.push(item);
      keys.push(key);
    } else if (key.length > keys[duplicateIndex].length) {
      result[duplicateIndex] = item;
      keys[duplicateIndex] = key;
    }
  }
  return result;
}

export default function ReviewPage() {
  const { sessionId, scopeKey } = useAuthSession();
  const [items, setItems] = useState<DueItem[]>([]);
  const [history, setHistory] = useState<MemoryHistoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [stats, setStats] = useState<Stats>({ total_tracked: 0, due_today: 0, mastered: 0, avg_retention: 0 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshStats = useCallback(async () => {
    if (!sessionId) return;
    const statsRes = await fetch(`${API}/srs/stats?session_id=${encodeURIComponent(sessionId)}`);
    if (statsRes.ok) setStats(await statsRes.json());
  }, [sessionId]);

  const loadReviewData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError("");
    try {
      const [dueRes, statsRes, historyRes] = await Promise.all([
        fetch(`${API}/srs/due?session_id=${encodeURIComponent(sessionId)}`),
        fetch(`${API}/srs/stats?session_id=${encodeURIComponent(sessionId)}`),
        fetch(`${API}/api/memory/history?session_id=${encodeURIComponent(sessionId)}&limit=24`),
      ]);

      if (!dueRes.ok) throw new Error("复习任务加载失败");
      const dueData = await dueRes.json();
      const validItems = dedupeReviewItems((dueData.items || []).filter(isValidReviewItem));
      setItems(validItems);
      setCurrentIndex(0);
      setSelectedId(validItems[0]?.node_id ?? null);

      if (statsRes.ok) setStats(await statsRes.json());
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory((data.items || []).filter((item: MemoryHistoryItem) => item.node_id));
      }
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "复习页加载失败");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    setItems([]);
    setHistory([]);
    setCurrentIndex(0);
    setSelectedId(null);
    setResult(null);
    setStats({ total_tracked: 0, due_today: 0, mastered: 0, avg_retention: 0 });
  }, [scopeKey]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  const current = items.find((item) => item.node_id === selectedId) || items[currentIndex] || null;
  const selectedHistory = useMemo(
    () => history.find((item) => item.node_id === selectedId) || history[0] || null,
    [history, selectedId]
  );
  const progress = items.length ? Math.min(100, Math.round((currentIndex / items.length) * 100)) : 100;

  const selectReviewItem = (nodeId: number) => {
    const index = items.findIndex((item) => item.node_id === nodeId);
    if (index >= 0) setCurrentIndex(index);
    setSelectedId(nodeId);
  };

  const submitReview = async (quality: number) => {
    if (!sessionId || !current || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/srs/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, node_id: current.node_id, quality }),
      });
      if (!res.ok) throw new Error("提交复习结果失败");
      const data: ReviewResult = await res.json();
      setResult(data);
      const reviewedNodeId = current.node_id;
      const nextHistory = history.filter((item) => item.node_id !== reviewedNodeId);
      const nextItems = items.filter((item) => item.node_id !== reviewedNodeId);
      const nextIndex = Math.min(currentIndex, Math.max(nextItems.length - 1, 0));
      const nextSelectedId = nextItems[nextIndex]?.node_id ?? null;
      setHistory(nextHistory);
      setItems(nextItems);
      setTimeout(() => {
        setCurrentIndex(nextIndex);
        setSelectedId(nextSelectedId);
        setResult(null);
        refreshStats();
      }, 650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LearnPageShell title="复习中心">
        <main className="review-main">
          <section className="review-hero">
            <div>
              <p className="eyebrow">复习中心</p>
              <h1>今天只处理最该复习的知识点</h1>
              <p className="hero-copy">复习页会读取你的知识树和记忆系统，把新添加的视频知识点变成可点击、可追踪的复习任务。</p>
            </div>
            <button className="refresh-btn" onClick={loadReviewData} disabled={loading}>刷新任务</button>
          </section>

          <section className="metric-grid">
            <div><strong>{stats.due_today}</strong><span>今日待复习</span></div>
            <div><strong>{stats.mastered}</strong><span>已掌握</span></div>
            <div><strong>{stats.total_tracked || history.length}</strong><span>追踪知识点</span></div>
            <div><strong>{Math.round((stats.avg_retention || 0) * 100)}%</strong><span>保持率</span></div>
          </section>

          {error && <div className="error-box">{error}</div>}

          <section className="review-layout">
            <div className="task-panel">
              <div className="panel-head">
                <div><p>今日队列</p><h2>{items.length ? `${currentIndex + 1}/${items.length}` : "暂无到期任务"}</h2></div>
                <span>{progress}%</span>
              </div>
              <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>

              {loading && <div className="empty-card">正在读取你的知识树和记忆记录...</div>}

              {!loading && current && (
                <article className="review-card">
                  <div className="type-row"><span>{current.node_type || "concept"}</span><span>下次 {formatDate(current.next_review_date)}</span></div>
                  <h2>{current.name}</h2>
                  <p>{current.definition || "这个知识点来自你的知识树，点击右侧详情可以回到对应章节和视频证据。"}</p>
                  <div className="memory-line">已复习 {current.repetitions} 次 · 间隔 {current.interval_days} 天 · 难度系数 {current.easiness_factor}</div>
                  <div className="action-row">
                    {REVIEW_ACTIONS.map((action) => (
                      <button key={action.value} className={`quality ${action.tone}`} onClick={() => submitReview(action.value)} disabled={submitting}>
                        <b>{action.label}</b><small>{action.hint}</small>
                      </button>
                    ))}
                  </div>
                  <Link className="tree-link" href={`/node/${current.node_id}`}>查看知识树章节</Link>
                  {result && <div className="result-box">已记录，本知识点下次复习间隔 {result.interval_days} 天</div>}
                </article>
              )}

              {!loading && !current && (
                <div className="empty-card">
                  <h2>今天没有到期卡片</h2>
                  <p>你仍然可以从右侧最近学习记录进入知识点详情，检查对应视频和章节。</p>
                </div>
              )}
            </div>

            <aside className="history-panel">
              <div className="panel-head compact"><div><p>待复习知识点</p><h2>处理后自动移出</h2></div></div>
              <div className="history-list">
                {items.slice(0, 12).map((item) => (
                  <button key={item.node_id} className={selectedId === item.node_id ? "history-item active" : "history-item"} onClick={() => selectReviewItem(item.node_id)}>
                    <span>{item.name}</span>
                    <small>{item.repetitions ? `已复习 ${item.repetitions} 次` : "新复习任务"} · 下次 {formatDate(item.next_review_date)}</small>
                  </button>
                ))}
                {!items.length && <p className="muted">当前没有待复习知识点。</p>}
              </div>
              {(current || selectedHistory)?.node_id && (
                <div className="detail-jump">
                  <p>选中知识点</p>
                  <h3>{current?.name || selectedHistory?.concept_name}</h3>
                  <span>进入后可以查看解释、关联章节，以及"前往B站看视频"按钮。</span>
                  <Link href={`/node/${current?.node_id || selectedHistory?.node_id}`}>打开知识点详情</Link>
                </div>
              )}
            </aside>
          </section>
        </main>
      <style jsx>{`
        .review-page { background: var(--bg); color: var(--ink); }
        .review-main { flex: 1; min-height: calc(100vh - 56px); padding: 24px; overflow: auto; background: var(--bg); }
        .review-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; max-width: 1180px; margin: 0 auto 18px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
        .eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: 0; color: var(--primary); font-weight: 800; }
        h1 { margin: 0; font-size: 34px; line-height: 1.18; letter-spacing: 0; color: var(--ink); }
        .hero-copy { max-width: 640px; margin: 10px 0 0; color: var(--text-secondary); line-height: 1.7; }
        .refresh-btn, .tree-link, .detail-jump a { border: 0; border-radius: 8px; background: var(--primary); color: white; padding: 10px 16px; font-weight: 800; text-decoration: none; cursor: pointer; white-space: nowrap; }
        .refresh-btn:disabled { opacity: .55; cursor: wait; }
        .metric-grid { max-width: 1180px; margin: 0 auto 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .metric-grid div { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; }
        .metric-grid strong { display: block; font-size: 28px; color: var(--primary); }
        .metric-grid span { color: var(--text-tertiary); font-size: 13px; }
        .error-box { max-width: 1180px; margin: 0 auto 14px; padding: 12px 14px; border: 1px solid rgba(239,68,68,.3); background: rgba(239,68,68,.12); color: var(--danger); border-radius: 8px; }
        .review-layout { max-width: 1180px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .85fr); gap: 16px; }
        .task-panel, .history-panel { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 18px; box-shadow: var(--shadow-lg); }
        .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .panel-head p { margin: 0 0 4px; color: var(--text-tertiary); font-size: 13px; }
        .panel-head h2 { margin: 0; font-size: 22px; color: var(--ink); }
        .panel-head > span { font-weight: 900; color: var(--primary); }
        .progress-track { height: 8px; background: var(--bg-sunken); border-radius: 99px; overflow: hidden; margin-bottom: 16px; }
        .progress-track div { height: 100%; background: linear-gradient(90deg, var(--primary), var(--primary-hover)); transition: width .25s ease; }
        .review-card { border: 1px solid var(--border); background: var(--bg-elevated); border-radius: 8px; padding: 22px; }
        .type-row { display: flex; justify-content: space-between; gap: 10px; color: var(--text-tertiary); font-size: 13px; margin-bottom: 14px; }
        .review-card h2 { margin: 0 0 12px; font-size: 30px; line-height: 1.25; color: var(--ink); }
        .review-card p { margin: 0; color: var(--ink-soft); line-height: 1.8; }
        .memory-line { margin-top: 16px; color: var(--text-tertiary); font-size: 13px; }
        .action-row { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; margin-top: 18px; }
        .quality { border-radius: 8px; border: 1px solid var(--border); padding: 12px 10px; cursor: pointer; background: var(--bg-sunken); text-align: left; }
        .quality b, .quality small { display: block; }
        .quality small { margin-top: 4px; color: var(--text-tertiary); }
        .quality.weak { border-color: rgba(245,158,11,.35); background: rgba(245,158,11,.1); color: var(--warning); }
        .quality.ok { border-color: rgba(16,185,129,.35); background: var(--primary-muted); color: var(--primary-hover); }
        .quality.good { border-color: rgba(16,185,129,.45); background: rgba(16,185,129,.18); color: var(--success); }
        .tree-link { display: inline-block; margin-top: 16px; background: var(--primary); }
        .result-box { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: var(--primary-muted); color: var(--primary-hover); font-weight: 700; }
        .empty-card { min-height: 220px; display: flex; flex-direction: column; justify-content: center; border: 1px dashed var(--border); border-radius: 8px; padding: 24px; color: var(--text-tertiary); }
        .empty-card h2 { margin: 0 0 8px; color: var(--ink); }
        .history-list { display: grid; gap: 8px; max-height: 430px; overflow: auto; padding-right: 4px; }
        .history-item { width: 100%; text-align: left; border: 1px solid var(--border); background: var(--bg-sunken); border-radius: 8px; padding: 11px 12px; cursor: pointer; }
        .history-item.active { border-color: var(--primary); box-shadow: inset 3px 0 0 var(--primary); background: var(--primary-muted); }
        .history-item span, .history-item small { display: block; }
        .history-item span { font-weight: 800; color: var(--ink); line-height: 1.35; }
        .history-item small { margin-top: 5px; color: var(--text-tertiary); }
        .detail-jump { margin-top: 14px; padding: 16px; border-radius: 8px; background: var(--bg-sunken); color: var(--ink); border: 1px solid var(--border); }
        .detail-jump p { margin: 0 0 6px; color: var(--primary); font-size: 13px; }
        .detail-jump h3 { margin: 0 0 8px; font-size: 20px; }
        .detail-jump span { display: block; color: var(--text-secondary); line-height: 1.6; font-size: 13px; }
        .detail-jump a { display: inline-block; margin-top: 14px; background: var(--primary); color: white; }
        .muted { color: var(--text-tertiary); line-height: 1.6; }
        @media (max-width: 900px) { .review-main { padding: 16px; } .review-hero { align-items: flex-start; flex-direction: column; } .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .review-layout { grid-template-columns: 1fr; } h1 { font-size: 28px; } .review-card h2 { font-size: 24px; } .action-row { grid-template-columns: 1fr; } }
      `}</style>
  </LearnPageShell>
  );
}
