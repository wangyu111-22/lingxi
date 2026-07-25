"use client";

"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useEffect, useState, useCallback } from "react";

interface ZoneHeaderProps {
  title: string;
  icon: React.ReactNode;
  color?: string;
  rightSlot?: React.ReactNode;
}

export default function ZoneHeader({ title, icon, color = "var(--primary)", rightSlot }: ZoneHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    try {
      setUserName(localStorage.getItem("lingxi_user_name") || "");
    } catch {}
  }, []);

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/workspace");
  }, [router]);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        backdropFilter: "blur(12px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
        gap: 16,
      }}
    >
      {/* 左侧：返回 + 标题 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={goBack}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--ink-soft)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          title="返回上一页"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--primary-muted)";
            e.currentTarget.style.color = "var(--primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "";
            e.currentTarget.style.color = "var(--ink-soft)";
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          {icon}
        </div>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>

      {/* 右侧：自定义内容 + 主题 + 用户 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {rightSlot}
        <button
          onClick={toggleTheme}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--ink-soft)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </button>
        {userName && (
          <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
            {userName}
          </span>
        )}
      </div>
    </header>
  );
}
