"use client";

import Link from "next/link";

interface ZoneCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  gradient: string;
  color: string;
}

export default function ZoneCard({ href, icon, title, desc, gradient, color }: ZoneCardProps) {
  return (
    <Link
      href={href}
      className="zone-card glow-border"
      style={{
        background: `linear-gradient(160deg, rgba(255,255,255,.86), rgba(255,255,255,.58)), linear-gradient(180deg, ${color}12, transparent 58%)`,
        backdropFilter: "blur(18px) saturate(1.12)",
        WebkitBackdropFilter: "blur(18px) saturate(1.12)",
        border: `1px solid ${color}1F`,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        borderRadius: 18,
        gap: 14,
        transition: "transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        minHeight: 200,
        animation: "floatIn 0.6s ease-out backwards",
        boxShadow: "0 16px 42px rgba(15,23,42,.07)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = `0 22px 54px rgba(15,23,42,.12), 0 12px 36px ${color}1A`;
        e.currentTarget.style.borderColor = `${color}3D`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 16px 42px rgba(15,23,42,.07)";
        e.currentTarget.style.borderColor = `${color}1F`;
      }}
    >
      {/* 大背景光晕 */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: 999,
          background: gradient,
          opacity: 0.08,
          filter: "blur(42px)",
          pointerEvents: "none",
          transition: "all 0.4s",
        }}
        className="zone-card-blob"
      />
      {/* 小光点 */}
      <div
        style={{
          position: "absolute",
          bottom: -20,
          left: -20,
          width: 80,
          height: 80,
          borderRadius: 999,
          background: gradient,
          opacity: 0.05,
          filter: "blur(30px)",
          pointerEvents: "none",
        }}
      />
      {/* 底部渐变条 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "20%",
          right: "20%",
          height: 3,
          borderRadius: "3px 3px 0 0",
          background: gradient,
          opacity: 0,
          transition: "all 0.3s",
        }}
        className="zone-card-bar"
      />
      {/* 图标 */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 14,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          boxShadow: `0 10px 28px ${color}2E`,
          position: "relative",
          zIndex: 1,
          transition: "all 0.3s",
        }}
        className="zone-card-icon"
      >
        {icon}
      </div>
      {/* 文字 */}
      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <h3
          style={{
            fontSize: 18,
            fontWeight: 800,
            margin: "0 0 6px",
            color: "var(--ink)",
            transition: "color 0.3s",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            margin: 0,
            lineHeight: 1.65,
            maxWidth: 200,
          }}
        >
          {desc}
        </p>
      </div>
    </Link>
  );
}
