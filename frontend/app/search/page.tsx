"use client";

import { useState } from "react";
import Link from "next/link";
import LearnPageShell from "@/components/LearnPageShell";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const base = window.location.hostname === "localhost"
        ? "/api"
        : "/api/proxy";
      const sid = typeof window !== "undefined" ? localStorage.getItem("lingxi_session") || "" : "";
      const resp = await fetch(base + "/search?q=" + encodeURIComponent(q) + "&type=all&limit=20&session_id=" + encodeURIComponent(sid));
      const data = await resp.json();
      // Jingyu: 防御性处理，确保字段至少是空数组
      setResults({
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        videos: Array.isArray(data.videos) ? data.videos : [],
      });
    } catch (e) {
      console.error(e);
      setResults({ nodes: [], videos: [] });
    }
    setLoading(false);
  };

  const tabs = [
    { key: "all", label: "全部" },
    { key: "nodes", label: "知识节点" },
    { key: "videos", label: "视频" },
  ];

  const nodes = results?.nodes || [];
  const videos = results?.videos || [];
  const totalCount = nodes.length + videos.length;

  return (
    <LearnPageShell title="知识搜索">
          <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>知识搜索</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                type="text" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
                placeholder="搜索知识点、视频..."
                style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 15, background: "var(--card-bg)", color: "var(--text-primary)" }}
              />
              <button onClick={() => doSearch(query)} disabled={loading}
                style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: loading ? "#9ca3af" : "#059669", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {loading ? "搜索中..." : "搜索"}
              </button>
            </div>

            {results && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                {tabs.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, background: tab === t.key ? "var(--accent,#059669)" : "transparent", color: tab === t.key ? "#fff" : "var(--text-secondary)" }}>
                    {t.label}{" "}{t.key === "all" ? `(${totalCount})` : t.key === "nodes" ? `(${nodes.length})` : `(${videos.length})`}
                  </button>
                ))}
              </div>
            )}

            {results && !loading && (
              <div>
                {(tab === "all" || tab === "nodes") && nodes.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    {tab === "all" && <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>知识节点 ({nodes.length})</h3>}
                    {nodes.map((n: any) => (
                      <div key={n.id} style={{ padding: "12px 16px", marginBottom: 8, borderRadius: 8, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, background: "#e0f2fe", color: "#0369a1" }}>{n.node_type || "concept"}</span>
                          <Link href={"/node/" + n.id} style={{ fontWeight: 600, fontSize: 15, color: "var(--text-primary)", textDecoration: "none" }}>{n.name}</Link>
                        </div>
                        {n.definition && <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0" }}>{n.definition.slice(0, 120)}</p>}
                        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                          <Link href="/tree" style={{ fontSize: 12, color: "#059669", textDecoration: "none" }}>知识树</Link>
                          <Link href={"/learning-path?target=" + encodeURIComponent(n.name)} style={{ fontSize: 12, color: "#059669", textDecoration: "none" }}>学习路径</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(tab === "all" || tab === "videos") && videos.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    {tab === "all" && <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>视频 ({videos.length})</h3>}
                    {videos.map((v: any) => (
                      <div key={v.bvid} style={{ padding: "12px 16px", marginBottom: 8, borderRadius: 8, background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                        <a href={"https://www.bilibili.com/video/" + v.bvid} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "var(--accent,#059669)", textDecoration: "none" }}>
                          {v.title}
                        </a>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {v.owner_name && <span>UP: {v.owner_name} · </span>}
                          {v.knowledge_node_count > 0 && <span>{v.knowledge_node_count} 知识点 · </span>}
                          <Link href="/organizer" style={{ color: "#059669" }}>整理中心</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {totalCount === 0 && (
                  <div style={{ textAlign: "center", padding: 60, color: "var(--text-tertiary)" }}>
                    <p style={{ fontSize: 48, marginBottom: 16 }}>🔍</p>
                    <p style={{ fontSize: 15 }}>未找到相关结果</p>
                    <p style={{ fontSize: 13, marginTop: 8 }}>试试其他关键词，或先去工作台编译视频</p>
                  </div>
                )}
              </div>
            )}

            {!results && !loading && (
              <div style={{ textAlign: "center", padding: 80, color: "var(--text-tertiary)" }}>
                <p style={{ fontSize: 15 }}>输入关键词搜索知识节点和视频</p>
              </div>
            )}
          </div>
  </LearnPageShell>
  );
}
