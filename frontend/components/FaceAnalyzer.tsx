"use client";

import { useState, useRef, useEffect, useCallback } from "react";

declare global { var faceapi: any; }

const MODEL_URL = "/models";

export interface FaceResult {
  age?: number; gender?: string; expression?: string; faceShape?: string;
  landmarks?: boolean; faceWidth?: number; faceLength?: number;
  noseLength?: number; eyeDistance?: number; jawWidth?: number; cheekWidth?: number;
}

export default function FaceAnalyzer({ onResult }: { onResult?: (r: FaceResult) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const loadModels = useCallback(async () => {
    if (loadedRef.current) return;
    setLoading(true); setError("");
    try {
      // Wait for face-api.js script to load
      for (let i = 0; i < 50; i++) {
        if (window.faceapi?.nets) break;
        await new Promise(r => setTimeout(r, 200));
      }
      if (!window.faceapi?.nets) throw new Error("face-api.js 脚本加载超时");
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await window.faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      loadedRef.current = true; setError("");
    } catch (e: any) {
      setError("模型加载失败: " + (e.message || "请刷新页面重试"));
    }
    setLoading(false);
  }, []);

  const startCamera = useCallback(async () => {
    await loadModels();
    if (!loadedRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: "user" } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setCameraOn(true); setError(""); }
    } catch { setError("无法访问摄像头，请允许权限后重试"); }
  }, [loadModels]);

  useEffect(() => {
    if (!cameraOn || !loadedRef.current) return;
    const video = videoRef.current; if (!video) return;
    const canvas = canvasRef.current; if (!canvas) return;
    let running = true;
    let timer: ReturnType<typeof setInterval>;

    const detect = async () => {
      if (!running || video.paused || video.ended) return;
      try {
        const det = await window.faceapi.detectSingleFace(video, new window.faceapi.TinyFaceDetector())
          .withFaceLandmarks().withAgeAndGender().withFaceExpressions();
        if (!det || !running) return;
        const dims = window.faceapi.matchDimensions(canvas, video, true);
        const resized = window.faceapi.resizeResults(det, dims);
        const ctx = canvas.getContext("2d");
        if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); window.faceapi.draw.drawFaceLandmarks(canvas, resized); }
        const exp = det.expressions.asSortedArray()[0];
        const m = getMeasurements(det.landmarks);
        const r: FaceResult = { age: Math.round(det.age), gender: det.gender === "male" ? "男" : "女", expression: exp.expression, faceShape: getShape(det.landmarks), landmarks: true, ...m };
        setResult(r); onResult?.(r);
        setError("");
      } catch (e: any) {
        setError("检测出错: " + (e.message || "请确保面部在摄像头范围内"));
      }
    };

    if (video.readyState >= 2) { timer = setInterval(detect, 400); }
    else { video.addEventListener("play", () => { timer = setInterval(detect, 400); }, { once: true }); }

    return () => { running = false; clearInterval(timer); };
  }, [cameraOn, onResult]);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setCameraOn(false); setResult(null);
  };

  const uploadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError("");
    try {
      await loadModels();
      if (!loadedRef.current) { setError("模型未就绪"); return; }
      const img = await createImageBitmap(file);
      const det = await window.faceapi.detectSingleFace(img, new window.faceapi.TinyFaceDetector())
        .withFaceLandmarks().withAgeAndGender().withFaceExpressions();
      if (det) {
        const exp = det.expressions.asSortedArray()[0];
        const m = getMeasurements(det.landmarks);
        const r: FaceResult = { age: Math.round(det.age), gender: det.gender === "male" ? "男" : "女", expression: exp.expression, faceShape: getShape(det.landmarks), landmarks: true, ...m };
        setResult(r); onResult?.(r);
      } else { setError("未检测到人脸，请换一张正面照片"); }
    } catch { setError("分析失败"); }
    setLoading(false);
  }, [loadModels, onResult]);

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 320, height: 320, margin: "0 auto 16px", borderRadius: 16, overflow: "hidden", background: "var(--bg-sunken)", border: "1px solid var(--border)" }}>
        <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: cameraOn ? "block" : "none" }} />
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: cameraOn ? "block" : "none" }} />
        {!cameraOn && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: 40 }}>📸</div>}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
        {!cameraOn ? (
          <button onClick={startCamera} disabled={loading} style={{ padding: "8px 20px", borderRadius: 12, border: "none", background: "#ec4899", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            {loading ? "⏳ 加载模型..." : "📷 打开摄像头"}
          </button>
        ) : (
          <button onClick={stopCamera} style={{ padding: "8px 20px", borderRadius: 12, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>⏹ 关闭摄像头</button>
        )}
        <label style={{ padding: "8px 20px", borderRadius: 12, border: "1px solid #ec4899", background: "transparent", color: "#ec4899", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
          🖼️ 上传照片
          <input type="file" accept="image/*" onChange={uploadImage} style={{ display: "none" }} />
        </label>
      </div>
      {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{error}</div>}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 320, margin: "0 auto" }}>
          {[["年龄", result.age+"岁"],["性别", result.gender||"--"],["表情", emoji(result.expression||"")],["脸型", result.faceShape||"--"]].map(([k,v]) => (
            <div key={k} style={{ padding: "8px 12px", borderRadius: 10, background: "var(--bg-sunken)", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ec4899" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function emoji(exp: string): string {
  return ({ happy: "😊开心", sad: "😢难过", angry: "😤生气", surprised: "😲惊讶", disgusted: "😖厌恶", fearful: "😨害怕", neutral: "😐平静" } as any)[exp] || exp;
}
function getShape(landmarks: any): string {
  if (!landmarks) return "未知";
  const p = landmarks.positions;
  const jw = Math.abs(p[16].x - p[0].x), fh = Math.abs(p[8].y - p[27].y), cb = Math.abs(p[14].x - p[2].x);
  if (fh/jw > 1.5) return "长脸型"; if (fh/jw < 1.1) return "圆脸型"; if (cb > jw*1.05) return "菱形脸";
  return "鹅蛋脸";
}
function getMeasurements(landmarks: any) {
  if (!landmarks) return {};
  const p = landmarks.positions;
  return { faceWidth: Math.round(Math.abs(p[16].x-p[0].x)), faceLength: Math.round(Math.abs(p[8].y-p[27].y)), noseLength: Math.round(Math.abs(p[30].y-p[27].y)), eyeDistance: Math.round(Math.abs(p[39].x-p[42].x)), jawWidth: Math.round(Math.abs(p[16].x-p[0].x)), cheekWidth: Math.round(Math.abs(p[14].x-p[2].x)) };
}
