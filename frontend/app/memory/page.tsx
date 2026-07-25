"use client";

import { useState } from "react";
import LearnPageShell from "@/components/LearnPageShell";
import MemoryDashboard from "@/components/MemoryDashboard";
import ProfilePanel from "@/components/ProfilePanel";
import { useAuthSession } from "@/lib/session";

type TabKey = "memory" | "profile";

export default function MemoryPage() {
  const { sessionId } = useAuthSession();
  const [tab, setTab] = useState<TabKey>("memory");

  return (
    <LearnPageShell title="记忆系统">
          <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                  {tab === "memory" ? "记忆系统" : "学习画像"}
                </h2>
                <p style={{ color: "var(--text-secondary)", marginTop: 4, fontSize: 14 }}>
                  {tab === "memory"
                    ? "追踪你的知识点掌握情况，智能安排复习计划"
                    : "6 维动态学习画像，了解你的学习状态"}
                </p>
              </div>
              {/* Tab 切换 */}
              <div style={{ display: "flex", background: "var(--bg-tertiary, #f3f4f6)", borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => setTab("memory")}
                  style={{
                    padding: "6px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: tab === "memory" ? "var(--card-bg, #fff)" : "transparent",
                    color: tab === "memory" ? "var(--text-primary)" : "var(--text-tertiary)",
                    fontWeight: tab === "memory" ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: tab === "memory" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  记忆
                </button>
                <button
                  onClick={() => setTab("profile")}
                  style={{
                    padding: "6px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: tab === "profile" ? "var(--card-bg, #fff)" : "transparent",
                    color: tab === "profile" ? "var(--text-primary)" : "var(--text-tertiary)",
                    fontWeight: tab === "profile" ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: tab === "profile" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  学习画像
                </button>
              </div>
            </div>

            {tab === "memory" ? (
              <MemoryDashboard />
            ) : sessionId ? (
              <ProfilePanel sessionId={sessionId} />
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "var(--text-tertiary)" }}>
                请先登录以查看学习画像
              </div>
            )}
          </div>
  </LearnPageShell>
  );
}
