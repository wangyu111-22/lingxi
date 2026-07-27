import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ========== 移动端 APK 打包 ==========
  turbopack: {
    root: process.cwd(),
  },
  transpilePackages: ['face-api.js'],
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.hdslb.com" },
      { protocol: "https", hostname: "**.bilivideo.com" },
      { protocol: "http", hostname: "localhost" },
    ],
    unoptimized: true,  // 静态导出需要关闭图片优化
  },
};

export default nextConfig;
