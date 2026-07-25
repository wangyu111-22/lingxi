import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ========== 移动端 APK 打包 ==========
  output: 'export',  // 静态导出，供 Capacitor 打包 APK
  transpilePackages: ['face-api.js'],
  typescript: {
    ignoreBuildErrors: true,
  },
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
