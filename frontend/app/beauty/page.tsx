"use client";

import Link from "next/link";
import ZoneShell from "@/components/ZoneShell";
import { useEffect, useState } from "react";
import { profileApi } from "@/lib/api";
import { readAuthSession } from "@/lib/session";

function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

interface BeautyProfile {
  gender?: "male" | "female" | string;
  height?: number | string;
  weight?: number | string;
}

function readBeautyProfile(): BeautyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("zhixi-beauty-profile");
    return saved ? JSON.parse(saved) as BeautyProfile : null;
  } catch {
    return null;
  }
}

export default function BeautyPage() {
  const [profile, setProfile] = useState<BeautyProfile | null>(() => readBeautyProfile());

  useEffect(() => {
    let cancelled = false;
    const sid = readAuthSession().sessionId;
    if (!sid) return;
    profileApi.getPersonal(sid, "beauty")
      .then((res) => {
        if (!cancelled && res.data && Object.keys(res.data).length > 0) {
          setProfile(res.data as BeautyProfile);
          localStorage.setItem("zhixi-beauty-profile", JSON.stringify(res.data));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <ZoneShell
      title="美美区域"
      icon={<Icon><path d="M12 2l2.5 7h7.5l-6 4.5 2.5 7.5-6.5-4.5-6.5 4.5 2.5-7.5-6-4.5h7.5z"/></Icon>}
      color="#f59e0b"
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            💄 美美空间
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            智慧穿搭推荐 · AI 妆容分析 · 个人形象管理
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {/* 个人信息卡片 */}
          <Link
            href="/beauty/profile"
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>个人形象档案</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {profile
                ? `${profile.gender === "male" ? "男" : "女"} · ${profile.height}cm · ${profile.weight}kg`
                : "完善身体数据，获取更精准的穿搭和妆容推荐 →"}
            </div>
            {!profile && (
              <div style={{ marginTop: 12, padding: "6px 14px", borderRadius: 20, background: "#f59e0b12", color: "#f59e0b", fontSize: 12, fontWeight: 500, display: "inline-block" }}>
                待完善
              </div>
            )}
          </Link>

          {/* 穿搭推荐卡片 */}
          <Link
            href="/beauty/outfit"
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>👗</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>智慧穿搭推荐</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              结合天气、场合和个人风格，AI 智能推荐每日穿搭方案
            </div>
            <div style={{ marginTop: 12, padding: "6px 14px", borderRadius: 20, background: "#06b6d412", color: "#06b6d4", fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
              🌤 天气感知
            </div>
          </Link>

          {/* 妆容推荐卡片 */}
          <Link
            href="/beauty/makeup"
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>💋</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>AI 妆容分析</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              上传照片分析脸型五官，智慧推荐适合你的妆容和产品
            </div>
            <div style={{ marginTop: 12, padding: "6px 14px", borderRadius: 20, background: "#ec489912", color: "#ec4899", fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
              📸 脸型分析
            </div>
          </Link>

          <Link
            href="/beauty/video"
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>实时相机分析</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              直接打开摄像头拍照，或上传照片，让 AI 分析妆容、肤色、脸型和穿搭比例
            </div>
            <div style={{ marginTop: 12, padding: "6px 14px", borderRadius: 20, background: "#8b5cf612", color: "#8b5cf6", fontSize: 12, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
              📸 在线拍照
            </div>
          </Link>

          <Link
            href="/beauty/inspiration"
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>潮流灵感库</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              粘贴小红书或抖音公开链接，把真实妆容、穿搭、发型素材接入 AI 推荐上下文
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "6px 12px", borderRadius: 20, background: "#fe2c5512", color: "#fe2c55", fontSize: 12, fontWeight: 700 }}>小红书</span>
              <span style={{ padding: "6px 12px", borderRadius: 20, background: "#11182712", color: "#111827", fontSize: 12, fontWeight: 700 }}>抖音</span>
            </div>
          </Link>
        </div>

        {/* 穿搭预览 */}
        <div
          style={{
            marginTop: 32,
            padding: "24px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>
            🌟 今日穿搭速览
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { style: "休闲日常", items: "白T恤 + 牛仔裤 + 帆布鞋", temp: "25-32°C" },
              { style: "通勤上班", items: "浅蓝衬衫 + 深色西裤 + 乐福鞋", temp: "22-28°C" },
              { style: "运动健身", items: "速干T恤 + 运动短裤 + 跑鞋", temp: "24-33°C" },
              { style: "约会出街", items: "碎花连衣裙 + 小白鞋 + 草帽", temp: "26-34°C" },
            ].map((look, i) => (
              <div
                key={i}
                style={{
                  padding: "14px 16px",
                  borderRadius: "var(--radius)",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{look.style}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{look.items}</div>
                <div style={{ fontSize: 11, color: "#06b6d4", display: "flex", alignItems: "center", gap: 4 }}>
                  🌤 {look.temp}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
