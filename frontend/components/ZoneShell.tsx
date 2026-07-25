"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ZoneHeader from "./ZoneHeader";

const AuroraBackground = dynamic(() => import("./AuroraBackground"), { ssr: false });
const BeamParticles = dynamic(() => import("./BeamParticles"), { ssr: false });

interface ZoneShellProps {
  children: React.ReactNode;
  title: string;
  icon: React.ReactNode;
  color?: string;
  headerRight?: React.ReactNode;
}

export default function ZoneShell({ children, title, icon, color, headerRight }: ZoneShellProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>
      <AuroraBackground />
      <BeamParticles />
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.5s ease-out, transform 0.5s ease-out",
        position: "relative", zIndex: 1,
      }}>
        <ZoneHeader title={title} icon={icon} color={color} rightSlot={headerRight} />
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
