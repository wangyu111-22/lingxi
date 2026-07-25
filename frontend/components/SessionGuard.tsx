"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readAuthSession } from "@/lib/session";

const PUBLIC_PATHS = new Set(["/", "/login"]);

/**
 * 统一处理会话门禁与过期跳转。
 */
export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname)) return;
    const { sessionId } = readAuthSession();
    if (!sessionId) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  useEffect(() => {
    const handleExpired = () => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("lingxi_session_expired", "1");
      }
      router.replace("/login");
    };
    window.addEventListener("lingxi:session-expired", handleExpired);
    return () => {
      window.removeEventListener("lingxi:session-expired", handleExpired);
    };
  }, [router]);

  return <>{children}</>;
}
