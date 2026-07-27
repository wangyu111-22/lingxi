"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ZoneShell from "@/components/ZoneShell";
import { ImportUrlResponse, knowledgeApi } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

const platforms = [
  { key: "xiaohongshu", name: "小红书", accent: "#fe2c55", hint: "适合导入妆容教程、OOTD、护肤流程、发型参考。" },
  { key: "douyin", name: "抖音", accent: "#111827", hint: "适合导入短视频趋势、热门风格、拍照姿势、穿搭灵感。" },
];

function detectPlatform(url: string) {
  if (url.includes("xiaohongshu.com") || url.includes("xhslink.com")) return "xiaohongshu";
  if (url.includes("douyin.com") || url.includes("iesdouyin.com")) return "douyin";
  return "";
}

export default function BeautyInspirationPage() {
  const { sessionId } = useAuthSession();
  const [url, setUrl] = useState("");
  const [scene, setScene] = useState("今日出门妆容与穿搭");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ImportUrlResponse[]>([]);

  const platform = useMemo(() => detectPlatform(url.trim()), [url]);
  const platformInfo = platforms.find((item) => item.key === platform);

  async function importInspiration() {
    const trimmed = url.trim();
    if (!sessionId) {
      setError("请先登录后再导入灵感素材。");
      return;
    }
    if (!trimmed || !platform) {
      setError("请粘贴小红书或抖音的公开分享链接。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await knowledgeApi.importUrl(trimmed, sessionId);
      setResults((prev) => [response, ...prev.filter((item) => item.source_id !== response.source_id)]);
      setUrl("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "灵感导入失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ZoneShell
      title="美美区域 / 潮流灵感库"
      icon={<span style={{ fontSize: 18 }}>✨</span>}
      color="#ec4899"
      headerRight={<Link href="/beauty" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>← 返回美美</Link>}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(320px,1fr) minmax(300px,.8fr)", gap: 20 }}>
        <section className="glow-border" style={{ padding: 24, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 38, marginBottom: 8 }}>💡</div>
            <h2 style={{ margin: "0 0 8px", color: "var(--ink)", fontSize: 22 }}>从真实内容生成个人化建议</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8 }}>
              贴入公开的小红书/抖音链接后，灵犀会提取标题、文案和风格线索，并写入当前账号的知识空间，后续可与照片分析、天气和个人形象档案一起作为推荐依据。
            </p>
          </div>

          <label style={{ display: "block", color: "var(--ink)", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>灵感链接</label>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <input
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
              placeholder="粘贴小红书或抖音公开分享链接"
              style={{ width: "100%", padding: "12px 14px", paddingRight: platformInfo ? 96 : 14, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", outline: "none" }}
            />
            {platformInfo && (
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: "5px 10px", borderRadius: 999, background: `${platformInfo.accent}14`, color: platformInfo.accent, fontSize: 12, fontWeight: 900 }}>
                {platformInfo.name}
              </span>
            )}
          </div>

          <label style={{ display: "block", color: "var(--ink)", fontSize: 13, fontWeight: 800, marginBottom: 6 }}>当前使用场景</label>
          <input
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="例如：通勤、约会、面试、校园拍照"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", marginBottom: 14 }}
          />

          <button onClick={importInspiration} disabled={loading || !url.trim()} style={{ width: "100%", border: "none", borderRadius: 14, padding: "12px 16px", color: "#fff", fontWeight: 900, background: loading || !url.trim() ? "#9ca3af" : "linear-gradient(135deg,#ec4899,#8b5cf6)", cursor: loading ? "wait" : "pointer" }}>
            {loading ? "正在解析灵感..." : "导入并加入 AI 上下文"}
          </button>
          {error && <p style={{ color: "#ef4444", fontSize: 12, margin: "10px 0 0" }}>{error}</p>}

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {platforms.map((item) => (
              <div key={item.key} style={{ padding: 14, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                <strong style={{ color: item.accent, fontSize: 13 }}>{item.name}</strong>
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7 }}>{item.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glow-border" style={{ padding: 24, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 14px", color: "var(--ink)" }}>本次导入</h3>
          {results.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", borderRadius: 14, background: "var(--bg-sunken)", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
              导入后会在这里看到素材标题、段落数和知识点数量。它们会进入当前用户知识空间，而不是只停留在页面展示里。
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {results.map((item) => (
                <div key={item.source_id} style={{ padding: 14, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.title}</strong>
                    <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{item.source_type}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 800 }}>{item.segment_count} 段素材</span>
                    <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 800 }}>{item.node_count} 个知识点</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{Math.max(1, Math.round(item.content_length / 1000))}k 字</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ margin: "22px 0 12px", color: "var(--ink)" }}>AI 如何使用</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              "照片分析页会根据脸型、肤色、场景输出妆容建议。",
              "穿搭页会结合天气、个人档案和导入灵感生成方案。",
              `当前场景：${scene || "未填写"}。`,
            ].map((text) => (
              <div key={text} style={{ padding: 12, borderRadius: 12, background: "var(--bg-sunken)", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7 }}>
                {text}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ZoneShell>
  );
}
