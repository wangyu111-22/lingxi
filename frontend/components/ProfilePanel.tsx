"use client";

import { useState, useEffect } from "react";
import { profileApi, ProfileData } from "@/lib/api";

interface Props {
  sessionId: string;
}

export default function ProfilePanel({ sessionId }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogMsg, setDialogMsg] = useState("");
  const [dialogRes, setDialogRes] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    profileApi
      .get(sessionId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const sendDialog = async () => {
    if (!dialogMsg.trim() || !sessionId) return;
    setDialogLoading(true);
    try {
      const res = await profileApi.dialog(dialogMsg, sessionId);
      setDialogRes(res.response);
      if (res.profile) setProfile(res.profile);
    } catch {
      setDialogRes("对话失败，请稍后重试");
    } finally {
      setDialogLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
        加载画像数据...
      </div>
    );
  }

  if (!profile || !profile.dimensions) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
        暂无学习数据，编译视频并收藏后即可生成画像
      </div>
    );
  }

  const dims = profile.dimensions;
  const dimList = Object.values(dims) as ProfileData["dimensions"][keyof ProfileData["dimensions"]][];
  const radarData = profile.radar;
  const labels = radarData.labels.length > 0 ? radarData.labels : dimList.map((d) => d.label);
  const values = radarData.values.length > 0 ? radarData.values : dimList.map((d) => d.score);

  // SVG 雷达图参数
  const cx = 150, cy = 150, r = 110;
  const n = values.length;
  const angleSlice = (2 * Math.PI) / n;

  const getPoint = (i: number, val: number) => {
    const angle = angleSlice * i - Math.PI / 2;
    const dist = r * Math.max(0.02, val);
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  };

  // 背景网格
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((level) => {
    const pts = Array.from({ length: n }, (_, i) => {
      const p = getPoint(i, level);
      return `${p.x},${p.y}`;
    }).join(" ");
    return <polygon key={level} points={pts} fill="none" stroke="var(--border-color, #e5e7eb)" strokeWidth="1" opacity="0.5" />;
  });

  // 轴线
  const axes = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, 1.05);
    return <line key={`a${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border-color, #e5e7eb)" strokeWidth="1" />;
  });

  // 数据多边形
  const dataPts = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, values[i]);
    return `${p.x},${p.y}`;
  }).join(" ");

  // 标签
  const labelPositions = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, 1.22);
    return { x: p.x, y: p.y, label: labels[i] };
  });

  const levelColors: Record<string, string> = {
    expert: "#22c55e",
    advanced: "#3b82f6",
    intermediate: "#f59e0b",
    beginner: "#f97316",
    novice: "#ef4444",
  };

  return (
    <div>
      {/* 综合评级 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          padding: "16px 20px",
          background: "var(--card-bg, #fff)",
          borderRadius: 12,
          border: "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 4 }}>
            综合学习评级
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>
            {profile.composite_label}
          </div>
        </div>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: `conic-gradient(${levelColors[profile.composite_level] || "#3b82f6"} ${Math.round(profile.composite_score * 360)}deg, var(--bg-tertiary, #f3f4f6) 0deg)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          {Math.round(profile.composite_score * 100)}%
        </div>
      </div>

      {/* 6 维雷达图 */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 20,
          padding: 16,
          background: "var(--card-bg, #fff)",
          borderRadius: 12,
          border: "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        <svg width="300" height="300" viewBox="0 0 300 300">
          {gridPolygons}
          {axes}
          <polygon
            points={dataPts}
            fill="rgba(59, 130, 246, 0.20)"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          {Array.from({ length: n }, (_, i) => {
            const p = getPoint(i, values[i]);
            return <circle key={`d${i}`} cx={p.x} cy={p.y} r="4" fill="#3b82f6" />;
          })}
          {labelPositions.map((lp, i) => (
            <text
              key={`t${i}`}
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--text-secondary)"
            >
              {lp.label}
            </text>
          ))}
        </svg>
      </div>

      {/* 6 维详情卡片 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 20 }}>
        {dimList.map((dim) => (
          <div
            key={dim.label}
            style={{
              padding: "14px 16px",
              background: "var(--card-bg, #fff)",
              borderRadius: 10,
              border: "1px solid var(--border-color, #e5e7eb)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{dim.label}</span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: `${levelColors[dim.level] || "#3b82f6"}22`,
                  color: levelColors[dim.level] || "#3b82f6",
                  fontWeight: 600,
                }}
              >
                {dim.label_cn}
              </span>
            </div>
            {/* 进度条 */}
            <div style={{ height: 6, background: "var(--bg-tertiary, #f3f4f6)", borderRadius: 3, marginBottom: 8 }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(dim.score * 100)}%`,
                  background: levelColors[dim.level] || "#3b82f6",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              {Object.entries(dim.detail || {})
                .filter(([, v]) => typeof v !== "object")
                .slice(0, 3)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </div>
          </div>
        ))}
      </div>

      {/* 对话式画像入口 */}
      <div
        style={{
          padding: 16,
          background: "var(--card-bg, #fff)",
          borderRadius: 12,
          border: "1px solid var(--border-color, #e5e7eb)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>
          与 AI 对话分析你的学习状态
        </div>
        {dialogRes && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 10,
              background: "var(--bg-secondary, #f9fafb)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {dialogRes}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={dialogMsg}
            onChange={(e) => setDialogMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendDialog()}
            placeholder="例如：我的薄弱环节在哪？给我一些建议..."
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border-color, #e5e7eb)",
              background: "var(--bg-primary, #fff)",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={sendDialog}
            disabled={dialogLoading || !dialogMsg.trim()}
            style={{
              padding: "8px 16px",
              background: dialogLoading ? "var(--text-tertiary)" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: dialogLoading ? "not-allowed" : "pointer",
            }}
          >
            {dialogLoading ? "分析中..." : "提问"}
          </button>
        </div>
      </div>
    </div>
  );
}
