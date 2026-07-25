"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_BASE = "/api/proxy/api/memory";

function fmt(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`;
  return `${(sec / 3600).toFixed(1)} 小时`;
}

interface MemoryStats {
  total_concepts: number;
  study_logs: number;
  tracked_videos: number;
  total_seconds: number;
  study_days: number;
}

interface MemoryHistoryItem {
  node_id?: number | null;
  concept_name?: string;
  video_title?: string;
  duration_seconds?: number;
  created_at?: string;
}

export default function MemoryDashboard() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [history, setHistory] = useState<MemoryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncMsg, setSyncMsg] = useState("");

  const loadData = async () => {
    const sid = localStorage.getItem("bilimind_session") || "demo_session";
    const [s, h] = await Promise.all([
      fetch(`${API_BASE}/stats?session_id=${sid}`).then((r) => r.json()),
      fetch(`${API_BASE}/history?limit=30&session_id=${sid}`).then((r) => r.json()),
    ]);
    setStats(s);
    setHistory(h.items || []);
  };

  useEffect(() => {
    setLoading(true);
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, []);

  const doSync = async () => {
    setSyncMsg("同步中...");
    try {
      const sid = localStorage.getItem("bilimind_session") || "demo_session";
      const r = await fetch(`${API_BASE}/sync-from-knowledge?session_id=${sid}`, { method: "POST" });
      const d = await r.json();
      setSyncMsg(`已同步 ${d.synced || 0} 条，跳过 ${d.skipped || 0} 条`);
      await loadData();
    } catch {
      setSyncMsg("同步失败");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>加载记忆数据...</div>;
  }

  const card = {
    padding: "16px 20px",
    borderRadius: 10,
    background: "var(--card-bg, #1e293b)",
    border: "1px solid var(--border)",
    textAlign: "center" as const,
  };

  const items = [
    { v: stats?.total_concepts || 0, l: "知识点总数", c: "#34d399" },
    { v: stats?.study_logs || 0, l: "学习记录", c: "#60a5fa" },
    { v: fmt(stats?.total_seconds || 0), l: "累计学习", c: "#a78bfa" },
    { v: stats?.study_days || 0, l: "学习天数", c: "#fbbf24" },
    { v: stats?.tracked_videos || 0, l: "追踪视频", c: "#f87171" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
        {items.map((item) => (
          <div key={item.l} style={card}>
            <div style={{ fontSize: 26, fontWeight: 700, color: item.c }}>{item.v}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{item.l}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={doSync}
          style={{ padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "var(--accent,#059669)", color: "#fff" }}
        >
          同步知识树到记忆系统
        </button>
        {syncMsg ? <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-secondary)" }}>{syncMsg}</span> : null}
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>最近学习记录</h3>
      <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--card-bg)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>知识点</th>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)" }}>来源</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>时长</th>
              <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-secondary)" }}>日期</th>
            </tr>
          </thead>
          <tbody>
            {history.slice(0, 15).map((h, i) => (
              <tr key={`${h.node_id || "row"}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>
                  {h.node_id ? (
                    <Link href={`/node/${h.node_id}`} style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}>
                      {(h.concept_name || "知识点").substring(0, 25)}
                    </Link>
                  ) : (
                    (h.concept_name || "知识点").substring(0, 25)
                  )}
                </td>
                <td style={{ padding: "8px 12px", color: "var(--text-secondary)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(h.video_title || "知识树").substring(0, 32)}
                </td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)", fontFamily: "monospace" }}>{fmt(h.duration_seconds || 0)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-tertiary)", fontSize: 11 }}>{(h.created_at || "").substring(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", marginTop: 12 }}>
        点击知识点可进入知识树对应章节，查看定义、来源视频和相关知识。
      </p>
    </div>
  );
}
