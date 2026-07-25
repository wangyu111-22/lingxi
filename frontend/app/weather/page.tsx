"use client";

import { useState, useCallback, useEffect } from "react";
import ZoneShell from "@/components/ZoneShell";
import VoiceButton from "@/components/VoiceButton";
import Link from "next/link";

const CITIES = ["北京","上海","广州","成都","杭州","深圳","武汉","南京"];
const API = "/api";
const WDAYS = ["周日","周一","周二","周三","周四","周五","周六"];

function WIcon(c: number): string {
  if (c <= 1) return "☀️"; if (c === 2) return "⛅"; if (c === 3) return "☁️";
  if (c <= 48) return "🌫️"; if (c <= 65) return "🌧️"; if (c <= 82) return "⛈️";
  return "🌤️";
}

const mockAlerts = [
  { icon: "☂️", text: "今日无降雨，无需带伞", type: "info" },
  { icon: "🧴", text: "紫外线指数强，记得涂防晒", type: "warn" },
  { icon: "💧", text: "湿度适中，注意补充水分", type: "info" },
  { icon: "🌡️", text: "午间气温较高，避免长时间户外活动", type: "warn" },
];

const outfitData = {
  top: ["短袖T恤", "薄款衬衫", "吊带背心"],
  bottom: ["短裤", "薄款长裤", "半身裙"],
  outer: ["防晒衫", "薄开衫"],
  accessories: ["太阳镜", "遮阳帽", "防晒伞"],
  tips: "今天32°C，天气炎热。建议轻薄透气穿搭，浅色系更防晒。",
};

/* SVG 图标 */
function Icon({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      {children}
    </svg>
  );
}

export default function WeatherPage() {
  const [city, setCity] = useState("北京");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [voiceMsg, setVoiceMsg] = useState("");
  const handleVoice = useCallback((t: string) => { setVoiceMsg(t); setTimeout(() => setVoiceMsg(""), 4000); }, []);

  const fetchWeather = useCallback(async (c: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/weather/current?city=${encodeURIComponent(c)}`);
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWeather(city); }, [city, fetchWeather]);

  return (
    <ZoneShell
      title="天气分区"
      icon={<Icon><circle cx="12" cy="8" r="5"/><path d="M3 19c0-2 1.5-3.5 3-4l1.5 1.5L9 15l1.5 1.5L12 15l1.5 1.5L15 15l1.5 1.5L18 15c1.5.5 3 2 3 4"/></Icon>}
      color="#06b6d4"
      headerRight={<VoiceButton onResult={handleVoice} color="#06b6d4" size={34} />}
    >
      {voiceMsg && <div style={{ textAlign:"center",marginBottom:14,padding:"8px 18px",borderRadius:16,background:"rgba(6,182,212,0.08)",border:"1px solid rgba(6,182,212,0.15)",fontSize:13,color:"#06b6d4",fontWeight:500,animation:"floatIn 0.3s ease",maxWidth:960,margin:"0 auto 14px" }}>🎙️ "{voiceMsg}"</div>}
      {/* 城市选择 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {CITIES.map(c => (
          <button key={c} onClick={() => setCity(c)} style={{
            padding: "8px 16px", borderRadius: 20,
            border: city===c ? "2px solid #06b6d4":"1px solid var(--border)",
            background: city===c ? "#06b6d410":"var(--bg-elevated)",
            color: city===c ? "#06b6d4":"var(--ink-soft)", cursor:"pointer",
            fontSize:13, fontWeight: city===c ? 600:400, transition:"all 0.2s",
          }}>{c}</button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* 左侧：天气 + 7日预报 + 警报 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 天气卡片 */}
          <div
            className="glow-border"
            style={{
              padding: "28px 24px",
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, #06b6d4, #22d3ee)",
              color: "#fff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{data?.city || city}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{new Date().toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
                </div>
                <div style={{ fontSize: 52, lineHeight: 1 }}>{data ? WIcon(data.current.weather_code) : "⏳"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
                <span style={{ fontSize: 56, fontWeight: 800 }}>{loading ? "..." : data?.current.temp ?? "--"}°</span>
                <span style={{ fontSize: 18, opacity: 0.85 }}>{data ? `/${data.forecast[0]?.low}° ${data.current.condition}` : "加载中..."}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px", marginTop: 16, fontSize: 13, opacity: 0.9 }}>
                <span>💧 湿度 {data?.current.humidity ?? "--"}%</span>
                <span>🌬 风速 {data?.current.wind_speed ?? "--"} km/h</span>
                <span>🌡 体感 {data?.current.feels_like ?? "--"}°</span>
                <span>🌤 {data?.current.condition ?? "加载中"}</span>
              </div>
            </div>
            <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.1)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -60, left: -30, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          </div>

          {/* 7日预报 */}
          <div
            className="glow-border"
            style={{
              padding: "20px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 14px" }}>📅 7日预报</h3>
            <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
              {(data?.forecast || []).map((day: any, i: number) => {
                const d = new Date(day.date);
                const label = i===0 ? "今天" : i===1 ? "明天" : WDAYS[d.getDay()];
                return (
                <div key={i} style={{
                  flex: 1, minWidth: 70, textAlign: "center",
                  padding: "10px 6px", borderRadius: "var(--radius)",
                  background: i===0 ? "#06b6d410" : "transparent",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{WIcon(day.code)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{day.high}°</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{day.low}°</div>
                </div>
              );})}
            </div>
          </div>

          {/* 注意事项 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>今日提醒</h3>
            {mockAlerts.map((alert, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 16px",
                  borderRadius: "var(--radius)",
                  background: alert.type === "warn" ? "rgba(245, 158, 11, 0.08)" : "var(--primary-muted)",
                  border: `1px solid ${alert.type === "warn" ? "rgba(245, 158, 11, 0.2)" : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 14,
                  color: "var(--ink-soft)",
                }}
              >
                <span style={{ fontSize: 18 }}>{alert.icon}</span>
                {alert.text}
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：穿搭推荐 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            className="glow-border"
            style={{
              padding: "24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
              👗 今日穿搭推荐
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6 }}>
              {outfitData.tips}
            </p>

            {[
              { label: "上装", items: outfitData.top, emoji: "👚" },
              { label: "下装", items: outfitData.bottom, emoji: "👖" },
              { label: "外套", items: outfitData.outer, emoji: "🧥" },
              { label: "配饰", items: outfitData.accessories, emoji: "🕶️" },
            ].map((cat) => (
              <div key={cat.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                  {cat.emoji} {cat.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {cat.items.map((item) => (
                    <span
                      key={item}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        background: "var(--primary-muted)",
                        color: "var(--primary)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <Link
              href="/beauty/outfit"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                fontSize: 13,
                color: "#06b6d4",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              前往美美区域完善穿搭偏好 →
            </Link>
          </div>

          {/* 更多功能预告 */}
          <div
            style={{
              padding: "20px 24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 32 }}>🔮</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>更多天气功能即将上线</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                7天预报 · 空气质量详情 · 生活指数 · 极端天气预警
              </div>
            </div>
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
