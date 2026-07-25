"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readAuthSession } from "@/lib/session";

export default function EntryPage() {
  const router = useRouter();

  useEffect(() => {
    const { sessionId } = readAuthSession();
    router.replace(sessionId ? "/dashboard" : "/login");
  }, [router]);

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "linear-gradient(135deg, #f8fafc 0%, #eefdf7 55%, #fff8ed 100%)",
      color: "#0f172a",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          margin: "0 auto 16px",
          background: "linear-gradient(135deg, #059669, #06b6d4)",
          boxShadow: "0 14px 34px rgba(5,150,105,.24)",
        }} />
        <strong style={{ fontSize: 18 }}>灵犀 LingXi</strong>
        <p style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>正在进入...</p>
      </div>
    </main>
  );
}
