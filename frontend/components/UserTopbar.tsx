"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import { clearAuthSession, useAuthSession } from "@/lib/session";

/**
 * 用户状态栏 — 显示当前登录用户 + 主题切换 + 樱花开关 + 退出按钮
 * 放在各页面的 topbar-actions 区域中
 */
export default function UserTopbar() {
  const router = useRouter();
  const { userName: user, sessionId: session } = useAuthSession();
  const { theme, toggleTheme } = useTheme();

  // 樱花掉落开关
  const [petalsOn, setPetalsOn] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("petals_enabled");
    if (saved !== null) setPetalsOn(saved === "true");
  }, []);

  const togglePetals = () => {
    const next = !petalsOn;
    setPetalsOn(next);
    localStorage.setItem("petals_enabled", String(next));
    window.dispatchEvent(new CustomEvent("petals-toggle", { detail: next }));
  };

  const handleLogout = () => {
    if (session) authApi.logout(session).catch(() => {});
    clearAuthSession();
    router.push("/");
  };

  return (
    <>
      {/* 返回按钮 */}
      <button
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="btn-icon"
        title="返回上一页"
        style={{ marginRight: 4 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* 樱花开关 */}
      <button
        onClick={togglePetals}
        className="btn-icon"
        title={petalsOn ? "关闭牡丹花飘落" : "开启牡丹花飘落"}
        style={{ marginRight: 4, opacity: petalsOn ? 1 : 0.5 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          {petalsOn ? (
            <>
              <path d="M12 3c-1 2-2 4-2 7s1 5 2 7c1-2 2-4 2-7s-1-5-2-7z" />
              <path d="M5 8c2 1 4 2 7 2s5-1 7-2" />
              <path d="M5 16c2-1 4-2 7-2s5 1 7 2" />
            </>
          ) : (
            <>
              <path d="M12 3v18M5 5l14 14M19 5L5 19" strokeWidth={1.5} />
              <circle cx="12" cy="12" r="7" fill="none" strokeWidth={1.5} />
            </>
          )}
        </svg>
      </button>

      {/* 主题切换 */}
      <button
        onClick={toggleTheme}
        className="btn-icon"
        title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
        style={{ marginRight: 4 }}
      >
        {theme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>
      {user && (
        <>
          <span className="user-chip">
            <span>已登录</span>
            <strong>{user}</strong>
          </span>
          <button onClick={handleLogout} className="btn-icon" title="退出登录 / 切换账户">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 18, height: 18 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </>
      )}
    </>
  );
}
