# 灵犀 LingXi — 移动端 APK 部署指南

## 方案对比

| 方案 | 难度 | 包体积 | 原生能力 | 推荐场景 |
|------|------|--------|---------|---------|
| **Capacitor.js** | ⭐⭐ | ~15MB | 中等 | 快速出 APK 参赛演示 |
| **PWA** | ⭐ | ~0MB | 无 | 零成本，浏览器安装 |
| **HarmonyOS 元服务** | ⭐⭐⭐ | ~5MB | 强 | 正式上架华为应用市场 |

---

## 方案一：Capacitor.js (推荐 ✅)

### 步骤 1：安装依赖

```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "灵犀 LingXi" "com.lingxi.app" --web-dir=out
```

### 步骤 2：构建静态文件

```bash
npm run build          # 输出到 out/ 目录
npx cap add android    # 创建 android/ 工程
npx cap sync           # 同步 web 资源到 android
```

### 步骤 3：生成 APK

```bash
cd android
./gradlew assembleDebug   # 生成 debug APK
# 或
./gradlew assembleRelease # 生成 release APK（需签名）
```

APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

### 步骤 4：签名（发布用）

```bash
keytool -genkey -v -keystore lingxi.keystore -alias lingxi -keyalg RSA -keysize 2048 -validity 10000
```

在 `android/app/build.gradle` 配置签名后执行：
```bash
./gradlew assembleRelease
```

---

## 方案二：PWA（最简单，零成本）

### 已是开箱即用！

已完成配置：
- ✅ `public/manifest.json` — PWA 应用清单
- ✅ `next.config.ts` — `output: 'export'` 静态导出
- ✅ `layout.tsx` — viewport meta 标签

### 部署到服务器后即可安装

用户访问 `https://你的域名` → 浏览器菜单 → "添加到主屏幕"

---

## 方案三：HarmonyOS 元服务（正式上架）

### 需要工具
- DevEco Studio 6.0+
- HarmonyOS 真机（或模拟器）
- 华为开发者账号（已有：hid72764299）

### 核心思路
元服务 = WebView 壳 + 加载线上前端

```typescript
// entry/src/main/ets/pages/Index.ets
import { webview } from '@kit.ArkUI';

@Entry
@Component
struct LingXiPage {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: 'https://你的域名', controller: this.controller })
        .width('100%')
        .height('100%')
    }
  }
}
```

### 发布流程
1. DevEco Studio → 新建元服务项目
2. 替换 WebView URL 为服务器地址
3. Build → Build App(s) → 生成 HAP/APP 包
4. 上传到 AppGallery Connect 审核发布

---

## 当前可直接测试

```bash
# 1. 构建静态文件
cd frontend
npm run build

# 2. 测试 PWA
npx serve out   # 用手机浏览器访问 http://局域网IP:3001
```

然后手机浏览器 → 添加到主屏幕 → 即可像 App 一样使用！
