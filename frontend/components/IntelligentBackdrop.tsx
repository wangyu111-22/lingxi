"use client";

import { useEffect, useRef } from "react";

type Variant = "dashboard" | "auth";

export default function IntelligentBackdrop({ variant = "dashboard" }: { variant?: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationId = 0;
    const pointer = { x: 0, y: 0, active: false };
    const particles = Array.from({ length: variant === "auth" ? 46 : 72 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00035,
      vy: (Math.random() - 0.5) * 0.00035,
      radius: 1.4 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      hue: index % 3,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    const palette = variant === "auth"
      ? ["rgba(5,150,105,", "rgba(6,182,212,", "rgba(196,120,30,"]
      : ["rgba(16,185,129,", "rgba(37,99,235,", "rgba(139,92,246,"];

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const mesh = ctx.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.0002) * width * 0.18,
        height * 0.32,
        0,
        width * 0.5,
        height * 0.42,
        Math.max(width, height) * 0.82,
      );
      mesh.addColorStop(0, variant === "auth" ? "rgba(5,150,105,0.12)" : "rgba(16,185,129,0.15)");
      mesh.addColorStop(0.45, variant === "auth" ? "rgba(37,99,235,0.08)" : "rgba(37,99,235,0.12)");
      mesh.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = mesh;
      ctx.fillRect(0, 0, width, height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -0.04) particle.x = 1.04;
        if (particle.x > 1.04) particle.x = -0.04;
        if (particle.y < -0.04) particle.y = 1.04;
        if (particle.y > 1.04) particle.y = -0.04;
      }

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        const ax = a.x * width;
        const ay = a.y * height;

        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const bx = b.x * width;
          const by = b.y * height;
          const dist = Math.hypot(ax - bx, ay - by);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.16;
            ctx.strokeStyle = `rgba(15,23,42,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }

        const pulse = 0.45 + Math.sin(time * 0.0012 + a.phase) * 0.25;
        ctx.fillStyle = `${palette[a.hue]}${0.26 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(ax, ay, a.radius + pulse, 0, Math.PI * 2);
        ctx.fill();

        if (pointer.active) {
          const dist = Math.hypot(ax - pointer.x, ay - pointer.y);
          if (dist < 180) {
            ctx.strokeStyle = `rgba(5,150,105,${(1 - dist / 180) * 0.24})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [variant]);

  return (
    <div className={`intelligent-backdrop ${variant}`} aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="backdrop-grid" />
      <div className="backdrop-lines">
        {Array.from({ length: 7 }, (_, index) => <span key={index} style={{ ["--line-index" as string]: index }} />)}
      </div>
      <div className="backdrop-beams">
        {Array.from({ length: 5 }, (_, index) => <i key={index} style={{ ["--beam-index" as string]: index }} />)}
      </div>
      <div className="backdrop-orbit one" />
      <div className="backdrop-orbit two" />
      <style jsx>{`
        .intelligent-backdrop {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(135deg, #f8fafc 0%, #eefdf7 44%, #f6f7ff 72%, #fff8ed 100%);
        }
        .intelligent-backdrop.auth {
          background:
            linear-gradient(135deg, #f8fafc 0%, #effdf7 52%, #fff8ed 100%);
        }
        canvas {
          position: absolute;
          inset: 0;
          opacity: 0.95;
        }
        .backdrop-grid {
          position: absolute;
          inset: -10%;
          background-image:
            linear-gradient(rgba(15,23,42,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.055) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at 50% 35%, black 0%, transparent 72%);
          animation: grid-drift 24s linear infinite;
        }
        .backdrop-lines {
          position: absolute;
          inset: 0;
          opacity: 0.56;
          filter: blur(0.2px);
        }
        .backdrop-lines span {
          position: absolute;
          left: -12%;
          right: -12%;
          top: calc(13% + var(--line-index) * 11%);
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(5,150,105,.2), rgba(37,99,235,.22), transparent);
          transform: rotate(calc(-7deg + var(--line-index) * 1.3deg));
          animation: line-wave calc(8s + var(--line-index) * 1s) ease-in-out infinite alternate;
        }
        .backdrop-beams i {
          position: absolute;
          top: -28%;
          left: calc(10% + var(--beam-index) * 19%);
          width: 2px;
          height: 60vh;
          border-radius: 999px;
          background: linear-gradient(180deg, transparent, rgba(6,182,212,.34), rgba(5,150,105,.16), transparent);
          transform: rotate(calc(-18deg + var(--beam-index) * 7deg));
          animation: beam-fall calc(8s + var(--beam-index) * 1.7s) linear infinite;
          animation-delay: calc(var(--beam-index) * -1.8s);
        }
        .backdrop-orbit {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(5,150,105,.14);
          box-shadow: inset 0 0 40px rgba(5,150,105,.05);
          animation: orbit-spin 30s linear infinite;
        }
        .backdrop-orbit.one {
          width: 520px;
          height: 520px;
          right: -120px;
          top: 8%;
        }
        .backdrop-orbit.two {
          width: 380px;
          height: 380px;
          left: -120px;
          bottom: 4%;
          border-color: rgba(37,99,235,.13);
          animation-duration: 38s;
          animation-direction: reverse;
        }
        @keyframes grid-drift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(56px, 56px, 0); }
        }
        @keyframes line-wave {
          from { transform: translateX(-2%) rotate(calc(-7deg + var(--line-index) * 1.3deg)); }
          to { transform: translateX(2%) rotate(calc(-5deg + var(--line-index) * 1.1deg)); }
        }
        @keyframes beam-fall {
          from { transform: translateY(-30vh) rotate(calc(-18deg + var(--beam-index) * 7deg)); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: .7; }
          to { transform: translateY(145vh) rotate(calc(-18deg + var(--beam-index) * 7deg)); opacity: 0; }
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.05); }
          to { transform: rotate(360deg) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .backdrop-grid, .backdrop-lines span, .backdrop-beams i, .backdrop-orbit {
            animation: none !important;
          }
          canvas { opacity: .35; }
        }
      `}</style>
    </div>
  );
}
