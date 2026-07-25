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
        background: `linear-gradient(160deg, ${color}0C, ${color}03)`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderColor: `${color}18`,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "36px 24px",
        borderRadius: "var(--radius-xl)",
        gap: 14,
        transition: "all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.2)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        minHeight: 200,
        animation: "floatIn 0.6s ease-out backwards",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-6px) scale(1.02)";
        e.currentTarget.style.boxShadow = `0 16px 48px ${color}22, 0 0 80px ${color}0A, inset 0 1px 0 ${color}15`;
        e.currentTarget.style.borderColor = `${color}35`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.borderColor = `${color}18`;
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
          borderRadius: "50%",
          background: gradient,
          opacity: 0.04,
          filter: "blur(50px)",
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
          borderRadius: "50%",
          background: gradient,
          opacity: 0.03,
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
          borderRadius: 18,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          boxShadow: `0 8px 28px ${color}35, 0 0 40px ${color}12`,
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
            fontWeight: 700,
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
            lineHeight: 1.5,
            maxWidth: 200,
          }}
        >
          {desc}
        </p>
      </div>
    </Link>
  );
}
