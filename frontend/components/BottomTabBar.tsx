"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/weather", label: "天气", icon: "weather", color: "#06b6d4" },
  { href: "/workspace", label: "学习", icon: "learn", color: "#059669" },
  { href: "/dashboard", label: "首页", icon: "home", color: "#059669", primary: true },
  { href: "/emotion", label: "树洞", icon: "heart", color: "#ec4899" },
  { href: "/home-garden", label: "小家", icon: "garden", color: "#84cc16" },
  { href: "/beauty", label: "美美", icon: "star", color: "#f59e0b" },
  { href: "/work", label: "工作", icon: "work", color: "#2563eb" },
  { href: "/harmony", label: "鸿蒙", icon: "harmony", color: "#dc2626" },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return null;

  const icons: Record<string, React.ReactNode> = {
    weather: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="5"/><path d="M3 19c0-2 1.5-3.5 3-4l1.5 1.5L9 15l1.5 1.5L12 15l1.5 1.5L15 15l1.5 1.5L18 15c1.5.5 3 2 3 4"/>
      </svg>
    ),
    learn: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3L2 9l10 6 10-6-10-6z"/><path d="M2 17l10 6 10-6"/><path d="M2 13l10 6 10-6"/>
      </svg>
    ),
    home: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
    heart: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    ),
    star: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2l2.5 7h7.5l-6 4.5 2.5 7.5-6.5-4.5-6.5 4.5 2.5-7.5-6-4.5h7.5z"/>
      </svg>
    ),
    garden: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
    work: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18"/>
      </svg>
    ),
    harmony: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7h6M9 11h6M10 17h4"/>
      </svg>
    ),
  };

  const isActive = (href: string) => {
    if (href === "/workspace") {
      return pathname.startsWith("/workspace") || pathname.startsWith("/tree") ||
        pathname.startsWith("/agent") || pathname.startsWith("/memory") ||
        pathname.startsWith("/learning") || pathname.startsWith("/game") ||
        pathname.startsWith("/review") || pathname.startsWith("/search");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 4,
        padding: "6px 8px max(6px, env(safe-area-inset-bottom))",
        background: "var(--bg-elevated)",
        borderTop: "1px solid var(--border)",
        zIndex: 9998,
        backdropFilter: "blur(16px)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "6px 10px",
              minWidth: 58,
              borderRadius: 12,
              textDecoration: "none",
              color: active ? tab.color : "var(--text-secondary)",
              fontWeight: active ? 600 : 400,
              fontSize: 11,
              transition: "all 0.2s",
              background: active ? `${tab.color}10` : "transparent",
              position: "relative",
            }}
          >
            {tab.primary && active && (
              <div style={{
                position: "absolute",
                top: -2,
                width: 24,
                height: 3,
                borderRadius: 2,
                background: tab.color,
              }} />
            )}
            {icons[tab.icon]}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
