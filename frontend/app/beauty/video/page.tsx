"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import { beautyApi, BeautyVideoAnalysis, BeautyVisionStatus } from "@/lib/api";
import { useAuthSession } from "@/lib/session";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function BeautyCameraPage() {
  const { sessionId } = useAuthSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [scene, setScene] = useState("实时自拍妆容分析");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BeautyVideoAnalysis | null>(null);
  const [history, setHistory] = useState<BeautyVideoAnalysis[]>([]);
  const [visionStatus, setVisionStatus] = useState<BeautyVisionStatus | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    beautyApi.videoHistory(sessionId).then((res) => setHistory(res.items)).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    beautyApi.visionStatus().then(setVisionStatus).catch(() => {});
  }, []);

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {
      setError("摄像头已打开，但浏览器阻止了视频播放，请再点一次打开摄像头或检查权限。");
    });
  }, [cameraOn]);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setError("无法打开摄像头，请检查浏览器权限，或改用照片上传。");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const width = video.videoWidth || 960;
    const height = video.videoHeight || 540;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoBlob(blob);
      setPhotoUrl(URL.createObjectURL(blob));
      setResult(null);
    }, "image/jpeg", 0.92);
  }

  function choosePhoto(file: File | null) {
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoBlob(file);
    setPhotoUrl(URL.createObjectURL(file));
    setResult(null);
  }

  async function analyze() {
    if (!sessionId) { setError("请先登录后再分析"); return; }
    if (!photoBlob) { setError("请先拍照或上传照片"); return; }
    setLoading(true);
    setError("");
    try {
      const name = photoBlob instanceof File ? photoBlob.name : "camera-capture.jpg";
      const res = await beautyApi.analyzeCapture(sessionId, photoBlob, scene, name);
      setResult(res.analysis);
      setHistory((prev) => [res.analysis, ...prev.filter((item) => item.id !== res.analysis.id)]);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "分析失败"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ZoneShell
      title="美美区域 / 实时相机分析"
      icon={<span style={{ fontSize: 18 }}>📷</span>}
      color="#8b5cf6"
      headerRight={<Link href="/beauty" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>← 返回美美</Link>}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(320px,1.05fr) minmax(320px,.95fr)", gap: 20 }}>
        <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>📸</div>
            <h2 style={{ margin: 0, color: "var(--ink)", fontSize: 22 }}>实时拍照分析</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}>打开摄像头直接拍照，或上传已有照片，AI 立即分析妆容、肤色、脸型和穿搭比例。</p>
            {visionStatus && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, padding: "6px 10px", borderRadius: 999, background: visionStatus.configured ? "rgba(16,185,129,.10)" : "rgba(245,158,11,.12)", color: visionStatus.configured ? "#059669" : "#b45309", fontSize: 12, fontWeight: 800 }}>
                <span>{visionStatus.configured ? "AI 视觉已配置" : "本地降级模式"}</span>
                <span style={{ opacity: .8 }}>{visionStatus.model || visionStatus.provider}</span>
              </div>
            )}
          </div>

          <div style={{ aspectRatio: "16/10", minHeight: 260, borderRadius: 16, background: "var(--bg-sunken)", overflow: "hidden", display: "grid", placeItems: "center", marginBottom: 12, border: "1px solid var(--border)", position: "relative" }}>
            {cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", background: "#111827" }} />
            ) : photoUrl ? (
              <img src={photoUrl} alt="已选择的照片" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                <div style={{ fontSize: 44 }}>📷</div>
                <div>打开摄像头或上传照片</div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            <button onClick={cameraOn ? stopCamera : startCamera} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #8b5cf630", background: cameraOn ? "rgba(239,68,68,.1)" : "rgba(139,92,246,.1)", color: cameraOn ? "#ef4444" : "#8b5cf6", fontWeight: 800, cursor: "pointer" }}>
              {cameraOn ? "关闭摄像头" : "打开摄像头"}
            </button>
            <button onClick={capturePhoto} disabled={!cameraOn} style={{ padding: "10px 12px", borderRadius: 12, border: "none", background: cameraOn ? "#8b5cf6" : "#9ca3af", color: "#fff", fontWeight: 800, cursor: cameraOn ? "pointer" : "not-allowed" }}>
              一键拍照
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>
              上传照片
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => choosePhoto(e.target.files?.[0] || null)} />

          <label style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", display: "block", marginBottom: 6 }}>分析场景</label>
          <input value={scene} onChange={(e) => setScene(e.target.value)} placeholder="例如：通勤妆容、约会穿搭、证件照妆容" style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", marginBottom: 12 }} />

          <button onClick={analyze} disabled={!photoBlob || loading} style={{ width: "100%", padding: "11px 16px", borderRadius: 12, border: "none", background: !photoBlob || loading ? "#9ca3af" : "linear-gradient(135deg,#8b5cf6,#ec4899)", color: "#fff", fontWeight: 900, cursor: loading ? "wait" : "pointer" }}>
            {loading ? "AI 正在分析照片..." : "让 AI 分析这张照片"}
          </button>
          {error && <p style={{ color: "#ef4444", fontSize: 12 }}>{error}</p>}
        </section>

        <section className="glow-border" style={{ padding: 22, borderRadius: 18, background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 14px", color: "var(--ink)" }}>分析结果</h3>
          {result ? (
            <div style={{ display: "grid", gap: 12 }}>
              {[
                ["场景识别", result.scene_summary],
                ["照片质量", result.movement_summary],
                ["拍照建议", result.style_advice],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: 14, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ color: "#8b5cf6", fontSize: 13 }}>{k}</strong>
                  <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", lineHeight: 1.7, fontSize: 13 }}>{v}</p>
                </div>
              ))}
              {result.recommendations && result.recommendations.length > 0 && (
                <div style={{ padding: 14, borderRadius: 14, background: "var(--bg-sunken)", border: "1px solid var(--border-light)" }}>
                  <strong style={{ color: "#ec4899", fontSize: 13 }}>平台视频/笔记推荐</strong>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {result.recommendations.map((rec, index) => (
                      <a
                        key={`${rec.platform}-${index}`}
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "block", padding: 12, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border)", textDecoration: "none" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                          <span style={{ color: "var(--ink)", fontSize: 13, fontWeight: 900 }}>{rec.title}</span>
                          <span style={{ color: rec.platform === "douyin" ? "#111827" : "#fe2c55", fontSize: 11, fontWeight: 900 }}>{rec.label}</span>
                        </div>
                        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6 }}>{rec.reason}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", background: "var(--bg-sunken)", borderRadius: 14 }}>拍照或上传照片后会显示分析结论。</div>
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
                {item.recommendations && item.recommendations.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {item.recommendations.slice(0, 2).map((rec, index) => (
                      <a
                        key={`${item.id}-${rec.platform}-${index}`}
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: "5px 9px", borderRadius: 999, background: rec.platform === "douyin" ? "#11182712" : "#fe2c5512", color: rec.platform === "douyin" ? "#111827" : "#fe2c55", fontSize: 11, fontWeight: 900, textDecoration: "none" }}
                      >
                        {rec.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </ZoneShell>
  );
}
