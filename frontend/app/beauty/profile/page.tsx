"use client";

import { useState, useEffect } from "react";
import ZoneShell from "@/components/ZoneShell";
import Link from "next/link";

const styleOptions = [
  { value: "casual", label: "休闲", emoji: "👕" },
  { value: "business", label: "商务", emoji: "👔" },
  { value: "sporty", label: "运动", emoji: "🏃" },
  { value: "sweet", label: "甜美", emoji: "🌸" },
  { value: "cool", label: "酷帅", emoji: "🖤" },
  { value: "elegant", label: "优雅", emoji: "💃" },
  { value: "retro", label: "复古", emoji: "📻" },
  { value: "street", label: "街头", emoji: "🎸" },
];

export default function ProfilePage() {
  const [form, setForm] = useState({
    gender: "",
    height: "",
    weight: "",
    bust: "",
    waist: "",
    hip: "",
    skinTone: "",
    preferences: [] as string[],
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const data = localStorage.getItem("zhixi-beauty-profile");
      if (data) setForm(JSON.parse(data));
    } catch {}
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const togglePreference = (value: string) => {
    setForm(prev => ({
      ...prev,
      preferences: prev.preferences.includes(value)
        ? prev.preferences.filter(p => p !== value)
        : [...prev.preferences, value],
    }));
  };

  const handleSave = () => {
    localStorage.setItem("zhixi-beauty-profile", JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius)",
    border: "1px solid var(--border)",
    background: "var(--bg-sunken)",
    color: "var(--ink)",
    fontSize: 14,
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <ZoneShell
      title="美美区域 / 个人形象档案"
      icon={<span style={{ fontSize: 18 }}>👤</span>}
      color="#f59e0b"
      headerRight={
        <Link href="/beauty" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
          ← 返回美美
        </Link>
      }
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>
            个人形象档案
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
            完善身体数据，获取更精准的穿搭和妆容推荐
          </p>
        </div>

        <div
          className="glow-border"
          style={{
            padding: "28px",
            borderRadius: "var(--radius-lg)",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
          }}
        >
          {/* 性别 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              性别
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { value: "male", label: "男", emoji: "👨" },
                { value: "female", label: "女", emoji: "👩" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleChange("gender", opt.value)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    borderRadius: "var(--radius)",
                    border: form.gender === opt.value ? "2px solid #f59e0b" : "1px solid var(--border)",
                    background: form.gender === opt.value ? "#f59e0b08" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    fontSize: 15,
                    fontWeight: 500,
                    color: "var(--ink)",
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{opt.emoji}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 身体数据 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px", marginBottom: 20 }}>
            {[
              { field: "height", label: "身高 (cm)", placeholder: "165" },
              { field: "weight", label: "体重 (kg)", placeholder: "55" },
              { field: "bust", label: "胸围 (cm)", placeholder: "86" },
              { field: "waist", label: "腰围 (cm)", placeholder: "68" },
              { field: "hip", label: "臀围 (cm)", placeholder: "92" },
              { field: "skinTone", label: "肤色", placeholder: "自然偏白 / 暖黄皮..." },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-soft)", display: "block", marginBottom: 4 }}>
                  {label}
                </label>
                <input
                  type="text"
                  value={(form as any)[field] || ""}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          {/* 风格偏好 */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block", marginBottom: 8 }}>
              🏷️ 风格偏好（可多选）
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {styleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => togglePreference(opt.value)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: form.preferences.includes(opt.value) ? "2px solid #f59e0b" : "1px solid var(--border)",
                    background: form.preferences.includes(opt.value) ? "#f59e0b10" : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: form.preferences.includes(opt.value) ? "#f59e0b" : "var(--ink-soft)",
                    transition: "all 0.2s",
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "var(--radius)",
              background: saved
                ? "var(--success)"
                : "linear-gradient(135deg, #f59e0b, #ef4444)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 15,
              fontWeight: 600,
              transition: "all 0.3s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {saved ? "✅ 保存成功！" : "💾 保存个人档案"}
          </button>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", marginTop: 12 }}>
            数据仅保存在本地浏览器，不会上传到服务器
          </div>
        </div>
      </div>
    </ZoneShell>
  );
}
