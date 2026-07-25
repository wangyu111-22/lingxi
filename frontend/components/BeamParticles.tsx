"use client";

import { useEffect, useRef } from "react";

interface Beam {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number;
  hue: number; width: number; length: number;
}

/**
 * BeamParticles — 光速粒子背景
 * 灵感来自 Aceternity UI background-beams-with-collision
 * Canvas 实现，光束在页面中移动、碰撞、淡出
 */
export default function BeamParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const beams: Beam[] = [];
    const MAX_BEAMS = 25;

    const spawnBeam = () => {
      if (beams.length >= MAX_BEAMS) return;
      const side = Math.floor(Math.random() * 4);
      let x = 0, y = 0, vx = 0, vy = 0;
      const speed = 1 + Math.random() * 2;
      switch (side) {
        case 0: x = Math.random() * w; y = -20; vx = (Math.random()-0.5)*1.5; vy = speed; break;
        case 1: x = w + 20; y = Math.random() * h; vx = -speed; vy = (Math.random()-0.5)*1.5; break;
        case 2: x = Math.random() * w; y = h + 20; vx = (Math.random()-0.5)*1.5; vy = -speed; break;
        case 3: x = -20; y = Math.random() * h; vx = speed; vy = (Math.random()-0.5)*1.5; break;
      }
      beams.push({ x, y, vx, vy, life: 0, maxLife: 180 + Math.random() * 200, hue: [200, 160, 270, 330][Math.floor(Math.random()*4)], width: 1 + Math.random() * 1.5, length: 80 + Math.random() * 160 });
    };

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      frame++;

      if (frame % 8 === 0) spawnBeam();

      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i];
        b.x += b.vx; b.y += b.vy; b.life++;
        if (b.life > b.maxLife || b.x < -100 || b.x > w + 100 || b.y < -100 || b.y > h + 100) {
          beams.splice(i, 1); continue;
        }
        const progress = b.life / b.maxLife;
        const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
        const fadeAlpha = alpha * 0.35;

        // 光束主线
        const grad = ctx.createLinearGradient(b.x, b.y, b.x - b.vx * b.length, b.y - b.vy * b.length);
        grad.addColorStop(0, `hsla(${b.hue}, 80%, 65%, ${fadeAlpha})`);
        grad.addColorStop(0.5, `hsla(${b.hue}, 80%, 55%, ${fadeAlpha * 0.5})`);
        grad.addColorStop(1, `hsla(${b.hue}, 80%, 55%, 0)`);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * b.length, b.y - b.vy * b.length);
        ctx.strokeStyle = grad;
        ctx.lineWidth = b.width;
        ctx.lineCap = "round";
        ctx.stroke();

        // 头部光点
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.width * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${b.hue}, 90%, 75%, ${fadeAlpha * 1.5})`;
        ctx.fill();
      }

      requestAnimationFrame(animate);
    };
    animate();

    return () => { window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.55 }}
    />
  );
}
