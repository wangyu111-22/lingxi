"use client";

import { useState, useCallback, useEffect } from "react";

interface VideoPlayerProps {
  bvid: string;
  title?: string;
  cid?: number | null;
  page?: number | null;
}

export default function VideoPlayer({ bvid, title, cid, page }: VideoPlayerProps) {
  const [expanded, setExpanded] = useState(false);

  const params = new URLSearchParams({
    bvid,
    page: String(page || 1),
    high_quality: "1",
    autoplay: "0",
    danmaku: "0",
  });
  if (cid) params.set("cid", String(cid));
  const playerUrl = `https://player.bilibili.com/player.html?${params.toString()}`;

  const toggleFullscreen = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) setExpanded(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expanded]);

  const iframeStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    border: "none",
  };

  return (
    <>
      {/* Inline player */}
      <div
        className="video-player-wrapper"
        style={{
          position: "relative",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
          maxWidth: 800,
          margin: "0 auto",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={playerUrl}
            style={iframeStyle}
            allowFullScreen
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            title={`B站: ${title || bvid}`}
          />
          {/* Click shield - prevents B站 redirect overlay from hijacking clicks */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Controls bar */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            padding: "8px 12px",
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          {/* Info text */}
          <span
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              marginRight: "auto",
            }}
          >
            使用B站播放器内置倍速设置 (齿轮图标)
          </span>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            title={expanded ? "收起" : "全屏观看"}
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              zIndex: 10,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
            {expanded ? "收起" : "全屏观看"}
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {expanded && (
        <div
          onClick={toggleFullscreen}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.93)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Top bar with title + close button */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 1400,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              fontSize: 13,
              borderRadius: "12px 12px 0 0",
              gap: 12,
            }}
          >
            <span style={{ opacity: 0.9, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || bvid}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>点击播放器内齿轮图标调倍速</span>
              <button
                onClick={toggleFullscreen}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1px solid rgba(255,255,255,0.25)",
                  color: "#fff",
                  borderRadius: 6,
                  padding: "5px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                收起
              </button>
            </div>
          </div>
          {/* Video */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 1400,
              boxShadow: "0 8px 48px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src={`${playerUrl}&autoplay=1`}
                style={iframeStyle}
                allowFullScreen
                allow="autoplay; fullscreen"
                title={`B站全屏: ${title || bvid}`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
