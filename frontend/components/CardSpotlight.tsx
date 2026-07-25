"use client";

import { useRef, type ReactNode } from "react";

/**
 * CardSpotlight — 鼠标跟随聚光灯卡片
 * 灵感来自 Aceternity UI card-spotlight
 * 鼠标在卡片上移动时产生光晕跟随效果
 */
export default function CardSpotlight({ children, color = "#059669", className = "" }: {
  children: ReactNode; color?: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);
    el.style.setProperty("--spot-opacity", "1");
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--spot-opacity", "0");
  };

  return (
    <div
      ref={ref}
      className={`card-spotlight ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "relative",
        overflow: "hidden",
        "--spot-color": color,
      } as React.CSSProperties}
    >
      {/* 聚光灯光晕 */}
      <div
        className="spotlight-glow"
        style={{
          position: "absolute",
          left: "var(--spot-x, -200px)",
          top: "var(--spot-y, -200px)",
          width: 350,
          height: 350,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}0F 0%, ${color}05 30%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          opacity: "var(--spot-opacity, 0)",
          transition: "opacity 0.2s ease-out",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {children}
    </div>
  );
}
