"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/weather", label: "天气", icon: "weather", color: "#06b6d4" },
  { href: "/workspace", label: "学习", icon: "learn", color: "#059669" },
  { href: "/emotion", label: "树洞", icon: "heart", color: "#ec4899" },
  { href: "/dashboard", label: "首页", icon: "home", color: "#059669", primary: true },
  { href: "/home-garden", label: "小家", icon: "garden", color: "#84cc16" },
  { href: "/beauty", label: "美美", icon: "star", color: "#f59e0b" },
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
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        width: "min(calc(100vw - 24px), 520px)",
        padding: "7px",
        background: "color-mix(in srgb, var(--bg-elevated) 88%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 72%, transparent)",
        borderRadius: 20,
        zIndex: 9998,
        backdropFilter: "blur(18px) saturate(1.25)",
        boxShadow: "0 18px 48px rgba(15,23,42,.14), inset 0 1px 0 rgba(255,255,255,.38)",
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
              justifyContent: "center",
              padding: tab.primary ? "8px 10px" : "7px 8px",
              flex: tab.primary ? "1.12 1 0" : "1 1 0",
              minWidth: 0,
              borderRadius: tab.primary ? 16 : 14,
              textDecoration: "none",
              color: active ? tab.color : "var(--text-secondary)",
              fontWeight: active ? 800 : 600,
              fontSize: 11,
              transition: "all 0.2s",
              background: tab.primary ? "linear-gradient(135deg,#059669,#06b6d4)" : active ? `${tab.color}12` : "transparent",
              position: "relative",
              transform: "none",
              boxShadow: tab.primary ? "0 10px 26px rgba(5,150,105,0.24)" : "none",
            }}
          >
            {tab.primary && active && (
              <div style={{
                position: "absolute",
                top: 3,
                width: 24,
                height: 3,
                borderRadius: 2,
                background: "rgba(255,255,255,.78)",
              }} />
            )}
            <span style={{
              width: tab.primary ? 30 : 24,
              height: tab.primary ? 30 : 24,
              display: "grid",
              placeItems: "center",
              borderRadius: 12,
              background: tab.primary ? "rgba(255,255,255,.16)" : "transparent",
              color: tab.primary ? "#fff" : "currentColor",
            }}>
              {icons[tab.icon]}
            </span>
            <span style={{ color: tab.primary ? "#fff" : "currentColor", whiteSpace: "nowrap" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
