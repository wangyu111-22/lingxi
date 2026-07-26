"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import { beautyApi, BeautyVideoAnalysis } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

export default function BeautyVideoPage() {
  const { sessionId } = useAuthSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [scene, setScene] = useState("日常穿搭展示");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BeautyVideoAnalysis | null>(null);
  const [history, setHistory] = useState<BeautyVideoAnalysis[]>([]);

  useEffect(() => {
    if (!sessionId) return;
    beautyApi.videoHistory(sessionId).then((res) => setHistory(res.items)).catch(() => {});
  }, [sessionId]);

  function chooseFile(next: File | null) {
    setFile(next);
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function analyze() {
    if (!sessionId) { setError("请先登录后再分析视频"); return; }
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await beautyApi.analyzeVideo(sessionId, file, scene);
      setResult(res.analysis);
      setHistory((prev) => [res.analysis, ...prev.filter((item) => item.id !== res.analysis.id)]);
    } catch (e: any) {
      setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ZoneShell
      title="美美区域 / 视频动态分析"
      icon={<span style={{ fontSize: 18 }}>🎥</span>}
      color="#8b5cf6"
      headerRight={<Link href="/beauty" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>← 返回美美</Link>}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(320px,1fr) minmax(320px,1fr)", gap: 20 }}>
        <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>🎬</div>
            <h2 style={{ margin: 0, color: "var(--ink)", fontSize: 22 }}>视频动态分析</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>适合穿搭走动、妆容展示、上镜表现检查。</p>
          </div>

          <div onClick={() => fileRef.current?.click()} style={{ aspectRatio: "16/10", borderRadius: 16, border: "2px dashed var(--border)", background: "var(--bg-sunken)", overflow: "hidden", display: "grid", placeItems: "center", cursor: "pointer", marginBottom: 14 }}>
            {preview ? <video src={preview} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ textAlign: "center", color: "var(--text-secondary)" }}><div style={{ fontSize: 42 }}>📹</div><div>点击选择视频</div></div>}
          </div>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={(e) => chooseFile(e.target.files?.[0] || null)} />

          <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: 6 }}>场景说明</label>
          <input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="例如：通勤穿搭、约会妆容、运动休闲" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", marginBottom: 12 }} />

          <button onClick={analyze} disabled={!file || loading} style={{ width: "100%", padding: "11px 16px", borderRadius: 12, border: "none", background: !file || loading ? "#9ca3af" : "linear-gradient(135deg,#8b5cf6,#ec4899)", color: "#fff", fontWeight: 800, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "正在分析动态表现..." : "开始动态分析"}
          </button>
          {error && <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p>}
        </section>

        <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 14px", color: "var(--ink)" }}>分析结果</h3>
          {result ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["场景识别", result.scene_summary],
                ["动态表现", result.movement_summary],
                ["优化建议", result.style_advice],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: 14, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ color: "#8b5cf6", fontSize: 13 }}>{k}</strong>
                  <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", lineHeight: 1.7, fontSize: 13 }}>{v}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-sunken)", borderRadius: 14 }}>上传视频后会显示动态分析结论。</div>
          )}

          <h3 style={{ margin: "22px 0 12px", color: "var(--ink)" }}>历史分析</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {history.length === 0 ? <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>暂无历史记录。</p> : history.map((item) => (
              <div key={item.id} style={{ padding: 12, borderRadius: 12, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "var(--ink)", fontSize: 13 }}>{item.filename}</strong>
                  <span style={{ color: "var(--text-tertiary)", fontSize: 11 }}>{item.date} {item.time}</span>
                </div>
                <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6 }}>{item.style_advice}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ZoneShell>
  );
}
