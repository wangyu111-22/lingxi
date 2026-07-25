"use client";

export default function Skeleton({ w, h, r = 12 }: { w?: string; h?: string; r?: number }) {
  return (
    <div style={{
      width: w || "100%", height: h || "20px", borderRadius: r,
      background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
      backgroundSize: "200% 100%", animation: "skShimmer 1.5s infinite",
    }} />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ padding: 24, borderRadius: 20, background: "#fff", border: "1px solid #f1f5f9" }}>
      <Skeleton w="80px" h="11px" r={20} />
      <div style={{ height: 14 }} />
      <Skeleton w="60%" h="20px" />
      <div style={{ height: 8 }} />
      <Skeleton w="90%" h="13px" />
      <div style={{ height: 20 }} />
      <Skeleton h="48px" r={14} />
    </div>
  );
}

export function PageLoading() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
      {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
