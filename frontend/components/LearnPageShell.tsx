"use client";

import ZoneShell from "./ZoneShell";

const LearnIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3L2 9l10 6 10-6-10-6z"/><path d="M2 17l10 6 10-6"/><path d="M2 13l10 6 10-6"/>
  </svg>
);

export default function LearnPageShell({
  children, title, subtitle,
}: {
  children: React.ReactNode; title: string; subtitle?: React.ReactNode;
}) {
  return (
    <ZoneShell title={"学习分区 · " + title} icon={LearnIcon} color="#059669" headerRight={subtitle}>
      <div style={{ position: "relative", minHeight: "calc(100vh - 150px)" }}>
        {children}
      </div>
    </ZoneShell>
  );
}
