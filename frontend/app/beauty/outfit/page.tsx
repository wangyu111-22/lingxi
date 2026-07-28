"use client";

import { useState, useEffect, useRef } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

const styleTags = ["休闲", "商务", "运动", "甜美", "酷帅", "优雅", "复古", "街头"];

interface WeatherData {
  current: { temp: number; condition: string; weather_code: number };
  forecast: Array<{ date: string; high: number; low: number; code: number; condition: string }>;
}

interface OutfitItem {
  id: number;
  style: string;
  scene: string;
  weather: string;
  items: string[];
  color: string;
  tempRange: string;
}

interface PlatformRecommendation {
  platform: string;
  label: string;
  title: string;
  reason: string;
  url: string;
}

interface OutfitAgentResult {
  success: boolean;
  outfit_advice: string;
  image_analysis?: {
    scene_summary?: string;
    movement_summary?: string;
    style_advice?: string;
  } | null;
  platform_recommendations: PlatformRecommendation[];
  error?: string;
}

function generateOutfits(weather: WeatherData | null): OutfitItem[] {
  const temp = weather?.current.temp ?? 25;
  const condition = weather?.current.condition ?? "晴";
  const code = weather?.current.weather_code ?? 1;
  const isRain = code >= 61 && code <= 82;

  if (temp > 30) {
    const base: OutfitItem[] = [
      {
        id: 1,
        style: "清凉日常",
        scene: "通勤/逛街",
        weather: `${temp}°C ${condition}`,
        items: ["冰丝短袖T恤", "棉麻短裤", "透气网面运动鞋", "遮阳帽"],
        color: "#06b6d4",
        tempRange: "炎热",
      },
      {
        id: 2,
        style: "度假风",
        scene: "约会/出游",
        weather: `${temp}°C ${condition}`,
        items: ["碎花吊带连衣裙", "编织宽檐帽", "平底凉鞋", "藤编手提包"],
        color: "#ec4899",
        tempRange: "炎热",
      },
      {
        id: 3,
        style: "运动清凉",
        scene: "健身/户外跑",
        weather: `${temp}°C ${condition}`,
        items: ["速干运动背心", "高腰运动短裤", "防晒冰袖", "轻量跑鞋"],
        color: "#059669",
        tempRange: "炎热",
      },
      {
        id: 4,
        style: "街头潮流",
        scene: "日常出街",
        weather: `${temp}°C ${condition}`,
        items: ["宽松印花T恤", "牛仔短裤", "帆布鞋", "棒球帽"],
        color: "#8b5cf6",
        tempRange: "炎热",
      },
    ];
    if (isRain) {
      return base.map((o) => ({
        ...o,
        items: [...o.items, "便携折叠伞", "防水凉鞋"],
        weather: `${temp}°C ${condition} 🌧`,
      }));
    }
    return base;
  }

  if (temp >= 20) {
    const base: OutfitItem[] = [
      {
        id: 1,
        style: "轻商务",
        scene: "上班/会议",
        weather: `${temp}°C ${condition}`,
        items: ["棉质衬衫", "直筒长裤", "乐福鞋", "简约手表"],
        color: "#6366f1",
        tempRange: "舒适",
      },
      {
        id: 2,
        style: "休闲舒适",
        scene: "逛街/咖啡",
        weather: `${temp}°C ${condition}`,
        items: ["针织薄衫", "九分牛仔裤", "帆布小白鞋", "帆布托特包"],
        color: "#f59e0b",
        tempRange: "舒适",
      },
      {
        id: 3,
        style: "运动休闲",
        scene: "健身/散步",
        weather: `${temp}°C ${condition}`,
        items: ["运动速干T恤", "弹力运动长裤", "轻便跑鞋", "运动腰包"],
        color: "#059669",
        tempRange: "舒适",
      },
      {
        id: 4,
        style: "文艺复古",
        scene: "书店/看展",
        weather: `${temp}°C ${condition}`,
        items: ["格纹衬衫", "A字半身裙", "复古玛丽珍鞋", "帆布袋"],
        color: "#ec4899",
        tempRange: "舒适",
      },
    ];
    if (isRain) {
      return base.map((o) => ({
        ...o,
        items: [...o.items.slice(0, 4), "防泼水外套"],
        weather: `${temp}°C ${condition} 🌧`,
      }));
    }
    return base;
  }

  // temp < 20
  const base: OutfitItem[] = [
    {
      id: 1,
      style: "通勤保暖",
      scene: "上班/通勤",
      weather: `${temp}°C ${condition}`,
      items: ["高领针织衫", "羊毛混纺长裤", "短靴", "羊毛围巾"],
      color: "#8b5cf6",
      tempRange: "偏凉",
    },
    {
      id: 2,
      style: "休闲暖意",
      scene: "周末出行",
      weather: `${temp}°C ${condition}`,
      items: ["厚款卫衣", "加绒牛仔裤", "马丁靴", "毛线帽"],
      color: "#f59e0b",
      tempRange: "偏凉",
    },
    {
      id: 3,
      style: "优雅大衣",
      scene: "约会/聚会",
      weather: `${temp}°C ${condition}`,
      items: ["羊毛连衣裙", "中长款大衣", "过膝长靴", "皮质手提包"],
      color: "#ec4899",
      tempRange: "偏凉",
    },
    {
      id: 4,
      style: "运动保暖",
      scene: "户外运动",
      weather: `${temp}°C ${condition}`,
      items: ["保暖运动夹克", "加厚运动裤", "防滑跑鞋", "运动手套"],
      color: "#059669",
      tempRange: "偏凉",
    },
  ];
  if (isRain) {
    return base.map((o) => ({
      ...o,
      items: [...o.items.slice(0, 4), "防风防水外套"],
      weather: `${temp}°C ${condition} 🌧`,
    }));
  }
  return base;
}

export default function OutfitPage() {
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [city] = useState("北京");
  const [idea, setIdea] = useState("今天想要自然、干净、适合出门的穿搭");
  const [profile, setProfile] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [agentResult, setAgentResult] = useState<OutfitAgentResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      setLoading(true);
      try {
        const resp = await fetch(`${API_BASE_URL}/weather/current?city=${encodeURIComponent(city)}`);
        if (resp.ok) {
          const data = await resp.json();
          setWeatherData(data);
        }
      } catch {
        // Use default fallback (null = 25°C assumed)
      }
      setLoading(false);
    };
    fetchWeather();
  }, [city]);

  const outfits = generateOutfits(weatherData);

  const toggleStyle = (s: string) => {
    setActiveStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const choosePhoto = (file: File | null) => {
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAgentResult(null);
    setAgentError("");
  };

  const askOutfitAgent = async () => {
    setAgentLoading(true);
    setAgentError("");
    try {
      const form = new FormData();
      form.append("idea", idea);
      form.append("profile", profile);
      form.append("weather", temp != null ? `${city} ${temp}°C ${conditionText}` : `${city} 天气未知`);
      form.append("styles", activeStyles.join("、"));
      if (photoFile) form.append("file", photoFile, photoFile.name);
      const resp = await fetch(`${API_BASE_URL}/beauty/outfit/analyze`, { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.detail || data.error || "穿搭 Agent 分析失败");
      setAgentResult(data);
    } catch (e: unknown) {
      setAgentError(e instanceof Error ? e.message : "穿搭 Agent 暂时不可用");
    } finally {
      setAgentLoading(false);
    }
  };

  const temp = weatherData?.current.temp;
  const conditionText = weatherData?.current.condition ?? "晴";

  return (
    <ZoneShell
      title="美美区域 / 穿搭推荐"
      icon={<span style={{ fontSize: 18 }}>👗</span>}
      color="#ec4899"
      headerRight={
        <Link
          href="/beauty"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
          }}
        >
          ← 返回美美
        </Link>
      }
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👗</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            智慧穿搭推荐
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            结合天气、场合和个人风格，AI 为你搭配每日最佳穿搭
          </p>

          {/* Weather status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 14,
              padding: "8px 18px",
              borderRadius: 20,
              background:
                temp != null && temp > 30
                  ? "rgba(239, 68, 68, 0.1)"
                  : temp != null && temp < 20
                  ? "rgba(99, 102, 241, 0.1)"
                  : "rgba(6, 182, 212, 0.1)",
              border: `1px solid ${
                temp != null && temp > 30
                  ? "rgba(239, 68, 68, 0.25)"
                  : temp != null && temp < 20
                  ? "rgba(99, 102, 241, 0.25)"
                  : "rgba(6, 182, 212, 0.25)"
              }`,
              fontSize: 13,
              fontWeight: 600,
              color:
                temp != null && temp > 30
                  ? "#ef4444"
                  : temp != null && temp < 20
                  ? "#6366f1"
                  : "#06b6d4",
            }}
          >
            {loading ? (
              <>⏳ 获取天气中...</>
            ) : temp != null ? (
              <>
                <span>
                  {temp > 30 ? "🔥" : temp >= 20 ? "☀️" : "❄️"}
                </span>
                <span>
                  {city} · {temp}°C {conditionText}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    opacity: 0.7,
                    padding: "2px 8px",
                    borderRadius: 10,
                    background:
                      temp > 30
                        ? "rgba(239, 68, 68, 0.15)"
                        : temp < 20
                        ? "rgba(99, 102, 241, 0.15)"
                        : "rgba(6, 182, 212, 0.15)",
                  }}
                >
                  {temp > 30 ? "炎热模式" : temp >= 20 ? "舒适模式" : "保暖模式"}
                </span>
              </>
            ) : (
              <>🌤 离线模式 · 默认推荐</>
            )}
          </div>
        </div>

        {/* Style filter */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
            🏷️ 你的风格偏好（可多选）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {styleTags.map((s) => (
              <button
                key={s}
                onClick={() => toggleStyle(s)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 20,
                  border: activeStyles.includes(s)
                    ? "2px solid #ec4899"
                    : "1px solid var(--border)",
                  background: activeStyles.includes(s) ? "#ec489910" : "transparent",
                  color: activeStyles.includes(s) ? "#ec4899" : "var(--ink-soft)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  transition: "all 0.2s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <Link
            href="/beauty/profile"
            style={{
              fontSize: 12,
              color: "var(--primary)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
            }}
          >
            📝 完善身体数据获取更精准推荐 →
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 0.95fr) minmax(320px, 1.05fr)",
            gap: 18,
            marginBottom: 24,
            alignItems: "stretch",
          }}
        >
          <section className="glow-border" style={{ padding: 20, borderRadius: "var(--radius-lg)", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#ec4899,#8b5cf6)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>AI</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>穿搭 Agent 对话框</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>想法 + 个人信息 + 全身照 + 天气</div>
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>你的想法</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={4}
              placeholder="例如：想要校园感、显高一点、适合今天出门拍照，不要太夸张"
              style={{ width: "100%", resize: "vertical", padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", lineHeight: 1.6, marginBottom: 12 }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>个人信息 / 身形备注</label>
            <input
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="例如：170cm，偏瘦，肩窄，想显精神"
              style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", marginBottom: 12 }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <button onClick={() => fileRef.current?.click()} style={{ padding: "11px 12px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-sunken)", color: "var(--ink)", fontWeight: 800, cursor: "pointer" }}>
                {photoFile ? "已选择全身照，可重新选择" : "上传全身照辅助分析"}
              </button>
              {photoPreview && (
                <img src={photoPreview} alt="已上传的穿搭参考照片" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }} />
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={(e) => choosePhoto(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </div>

            <button onClick={askOutfitAgent} disabled={agentLoading || (!idea.trim() && !photoFile)} style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: "none", background: agentLoading ? "#9ca3af" : "linear-gradient(135deg,#ec4899,#8b5cf6)", color: "#fff", fontWeight: 900, cursor: agentLoading ? "wait" : "pointer" }}>
              {agentLoading ? "AI 正在生成穿搭..." : "让 AI 重新推荐穿搭"}
            </button>
            {agentError && <p style={{ color: "#ef4444", fontSize: 12, margin: "10px 0 0" }}>{agentError}</p>}
          </section>

          <section className="glow-border" style={{ padding: 20, borderRadius: "var(--radius-lg)", background: "var(--bg-elevated)", border: "1px solid var(--border)", minHeight: 320 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#06b6d4,#ec4899)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900 }}>搭</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>小灵穿搭建议</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>根据你刚才的想法实时生成</div>
              </div>
            </div>
            {!agentResult && !agentLoading ? (
              <div style={{ height: 230, display: "grid", placeItems: "center", textAlign: "center", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8 }}>
                <div>
                  <div style={{ fontSize: 38, marginBottom: 8 }}>🧥</div>
                  填写你的出门场景、身形备注，或上传全身照，AI 会给出穿搭方案和小红书/抖音参考入口。
                </div>
              </div>
            ) : agentLoading ? (
              <div style={{ height: 230, display: "grid", placeItems: "center", color: "var(--text-secondary)", fontSize: 13 }}>正在结合天气、风格和照片分析...</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 14, background: "rgba(236,72,153,.06)", border: "1px solid rgba(236,72,153,.14)", color: "var(--ink)", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {agentResult?.outfit_advice}
                </div>
                {agentResult?.image_analysis?.scene_summary && (
                  <div style={{ padding: 12, borderRadius: 12, background: "var(--bg-sunken)", border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7 }}>
                    {agentResult.image_analysis.scene_summary}
                  </div>
                )}
                {(agentResult?.platform_recommendations?.length ?? 0) > 0 && (
                  <div style={{ display: "grid", gap: 8 }}>
                    {agentResult!.platform_recommendations.map((rec, i) => (
                      <a key={`${rec.platform}-${i}`} href={rec.url} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--bg-sunken)", border: "1px solid var(--border)", textDecoration: "none" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, fontWeight: 800, color: "var(--ink)" }}>
                          <span>{rec.title}</span>
                          <span style={{ color: rec.platform === "douyin" ? "#111827" : "#fe2c55" }}>{rec.label}</span>
                        </div>
                        <p style={{ margin: "5px 0 0", color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.6 }}>{rec.reason}</p>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Outfit cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="glow-border"
              style={{
                padding: "20px",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                transition: "all 0.3s",
                position: "relative",
              }}
            >
              {/* Weather badge in top-right corner */}
              <div
                style={{
                  position: "absolute",
                  top: -1,
                  right: -1,
                  padding: "4px 10px",
                  borderRadius: "0 12px 0 12px",
                  background:
                    outfit.tempRange === "炎热"
                      ? "rgba(239, 68, 68, 0.9)"
                      : outfit.tempRange === "偏凉"
                      ? "rgba(99, 102, 241, 0.9)"
                      : "rgba(6, 182, 212, 0.9)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>
                  {outfit.tempRange === "炎热" ? "🔥" : outfit.tempRange === "偏凉" ? "❄️" : "☀️"}
                </span>
                <span>{outfit.weather}</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 12,
                    background: `${outfit.color}15`,
                    color: outfit.color,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {outfit.style}
                </div>
                <div style={{ fontSize: 18 }}>👔</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, display: "flex", gap: 12 }}>
                <span>📍 {outfit.scene}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outfit.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 13,
                      color: item.includes("伞") || item.includes("防水") ? "#06b6d4" : item.includes("防晒") ? "#f59e0b" : "var(--ink-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontWeight: item.includes("伞") || item.includes("防水") || item.includes("防晒") ? 600 : 400,
                    }}
                  >
                    <span
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: outfit.color,
                        display: "inline-block",
                      }}
                    />
                    {item}
                    {item.includes("伞") || item.includes("防水") ? (
                      <span style={{ fontSize: 10, background: "rgba(6, 182, 212, 0.15)", color: "#06b6d4", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>
                        天气适配
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-secondary)", fontSize: 13 }}>
            ⏳ 正在获取实时天气，为您生成精准推荐...
          </div>
        )}
      </div>
    </ZoneShell>
  );
}
