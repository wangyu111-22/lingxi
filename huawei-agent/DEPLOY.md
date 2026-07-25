# 灵犀 LingXi — 华为小艺开放平台部署指南

## 当前状态

灵犀已按照华为小艺开放平台 Agent 规范完成开发，支持以下部署方式：

### 方式一：云端 Agent + Web 前端（推荐参赛）

灵犀采用**云工作流模式**，后端 API 部署在云服务器，前端为 Web 应用。
小艺开放平台接入方式：使用 **云A2A模式**，通过 API 协议对接。

```
用户 → 小艺语音/搜索 → 意图框架 → 灵犀 Agent API → 返回结果
```

### 方式二：HarmonyOS 元服务

将前端打包为 HarmonyOS WebView 元服务，通过 DevEco Studio 发布。

## 已完成的 Agent 规范

- [x] 6 个 Skill 注册（天气感知/学习管理/陪伴树洞/穿搭美妆/智慧决策/鸿蒙协同）
- [x] Sense → Decide → Act 流水线
- [x] 意图匹配引擎 match_intent()
- [x] 5 端设备支持（手机/平板/手表/耳机/智慧屏）
- [x] 天气 API（Open-Meteo 免费）
- [x] AI 对话（DeepSeek LLM）
- [x] 自然交互（语音按钮/文本对话/滚轮手势）

## 在 小艺开放平台注册

1. 访问 https://developer.huawei.com/consumer/cn/hag/hagindex.html
2. 登录华为开发者账号
3. 选择「新建项目」→「智能体」→「云工作流模式」
4. 填写 Agent 信息（见 agent-manifest.json）
5. 配置 API 端点指向部署的服务器
6. 选择支持设备：手机/平板/手表/耳机/智慧屏
7. 提交审核

## 本地运行

```bash
# 后端
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 前端
cd frontend && npm run dev
```

访问 http://localhost:3000

## 注意事项

- 不违反华为开发者联盟用户协议
- 数据采集遵循最小必要原则
- 用户学习数据本地存储，不上传第三方
- 遵循华为隐私声明要求
