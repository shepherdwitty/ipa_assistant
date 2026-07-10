# 音标小助手（IPA Kids）

面向家长与老师的 **儿童国际音标识读辅助工具**。  
从真实教材图片里「拍照建库」，用英式 IPA 把 **字母组合 ↔ 音标** 讲清楚，并辅以轻量练习。

> 本地优先、无账号；支持浏览器开发，以及 macOS 桌面端（Apple Silicon / Intel）。

---

## 它解决什么问题

陪孩子学英语时，常见痛点是：

- 绘本 / 单词卡 / 练习纸上的词很多，手工查音标很累  
- 孩子看得见拼写，却很难建立 **字母或字母组合** 与 **发音** 的对应  
- 想围绕某个音（如 `/f/`）找词、对比，词库不趁手  

本工具的核心闭环：

```text
拍照 / 上传 / 手动录入
  → OCR 提词 + 人工轻校对
  → 生成英式 IPA 并入库
  → 按音标反查 / 单词音形拆解
  → 轻量练习（找词、配对、规律卡片）
```

产品说明见 [`docs/2026-07-10-ipa-tool-prd.md`](docs/2026-07-10-ipa-tool-prd.md)。

---

## 功能一览

| 模块 | 说明 |
|------|------|
| **导入** | 拍照、相册、截图 OCR；也可手动粘贴补录 |
| **校对** | 确认 / 剔除识别结果后再入库 |
| **词库** | 本地词表；支持按音标反查相关词 |
| **音形拆解** | 单词内字母组合与音标上下对齐，点击听音 |
| **练习** | 音标找词、拆解配对、规律卡片巩固 |
| **发音** | 单音素：本地 48 音标真人录音；整词：Edge TTS（可回退系统语音） |

### 明确不做（当前版本）

- 完整课程体系 / 账号体系 / 云同步  
- 美式 / 多口音切换、发音打分  
- 手写体 OCR、重度游戏化  

音形对应为 **教学向启发式映射**，界面使用「最相关字母组合」等表述，**不承诺语言学绝对精确**。

---

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | Vite · React 19 · TypeScript · React Router · Tailwind CSS v4 |
| 本地数据 | Dexie（IndexedDB），无后端账号 |
| OCR | Tesseract.js（浏览器端） |
| IPA | 内置英式词表 + Free Dictionary API 回退 |
| 音素音频 | `public/phonemes/` 本地 MP3（中国教学 48 音标） |
| 整词 TTS | `node-edge-tts`（微软 Edge 在线神经语音，best-effort） |
| 桌面 | Electron（macOS **arm64 + x64**） |

---

## 快速开始

### 环境要求

- Node.js 20+（建议 LTS）  
- macOS / Linux / Windows 均可跑 Web 开发  
- 打 macOS 安装包需在 Mac 上执行  

### 安装

```bash
git clone <你的仓库地址>.git
cd IPA   # 或你的目录名
npm install
```

### 浏览器开发

```bash
./dev.sh
# 或
npm run dev
```

默认端口（可用环境变量覆盖）：

| 服务 | 端口 | 环境变量 |
|------|------|----------|
| Vite 前端 | `17321` | `WEB_PORT` |
| Edge TTS | `17322` | `TTS_PORT` |

- 前端：<http://localhost:17321/>  
- TTS 探测：<http://127.0.0.1:17322/health>  

仅前端（不启 TTS，整词会回退系统语音）：

```bash
npm run dev:web
```

### Electron 开发（macOS 桌面）

主进程会内嵌 TTS，一般只需：

```bash
npm run dev:electron
```

可选打开 DevTools：

```bash
ELECTRON_DEVTOOLS=1 npm run dev:electron
```

### 测试与构建

```bash
npm test              # 领域逻辑单测
npm run lint          # oxlint
npm run build         # 仅 Web → dist/
```

### 打包 macOS 客户端

```bash
npm run build:mac           # arm64 + Intel → release/
npm run build:mac:arm64     # 仅 Apple Silicon
npm run build:mac:x64       # 仅 Intel
```

产物示例：

- `release/音标小助手-0.1.0-mac-arm64.dmg`  
- `release/音标小助手-0.1.0-mac-x64.dmg`  

当前配置为 **未代码签名**。本机安装若被拦截：右键 App → 打开，或在「系统设置 → 隐私与安全性」中允许。对外分发建议使用 Apple 开发者账号完成公证。

---

## 应用路由

| 路径 | 说明 |
|------|------|
| `/` | 导入（OCR / 手动） |
| `/review/:importId` | 识别校对 |
| `/library` | 词库 / 音标库 |
| `/word/:wordId` | 单词音形拆解 |
| `/practice` | 练习入口 |
| `/practice/cards` | 规律卡片列表 |
| `/practice/rules/:cardId` | 规律卡片详情 |

---

## 发音说明

### 单音素（本地）

- 目录：[`public/phonemes/`](public/phonemes/)  
- 覆盖中国英语教学常用 **48 个国际音标**（单元音 / 双元音 / 辅音，含 ts、dz、tr、dr 等）  
- 音源与整理说明见 [`public/phonemes/ATTRIBUTION.md`](public/phonemes/ATTRIBUTION.md)  
- 映射表：`src/data/phoneme-audio-map.ts`  

音频 URL 使用**站点根路径**（如 `/phonemes/n.mp3`），避免在 `/word/:id` 等嵌套路由下相对路径解析错误。

### 整词（在线 TTS）

1. 优先请求本地 `/api/tts`（开发时由 Vite 代理到 TTS 服务；Electron 生产包由主进程同源提供）  
2. 底层使用社区方案 **node-edge-tts**（微软 Edge 朗读能力，**非官方 API、无 SLA**）  
3. 失败时回退浏览器 **Web Speech API**  
4. 合成需 **联网**；结果会缓存在本机（开发：系统临时目录；Electron：应用 `userData/tts-cache`）  

请勿将 Key 或未授权的公共代理硬编码进仓库。若改为 Azure Speech 等官方服务，仅在服务端 / 主进程持有密钥。

---

## 数据与隐私

- **无注册登录**，数据默认只在本机  
- Web：浏览器 **IndexedDB**（清除站点数据即丢失）  
- Electron：Chromium 分区本地存储 + TTS 磁盘缓存  
- OCR 在浏览器 / 客户端本地完成（Tesseract.js），不会把图片发到本项目自有服务器  
- 整词 Edge TTS 会将**待朗读文本**发往微软相关在线服务（社区客户端实现），请知悉  

---

## 仓库结构（简要）

```text
├── electron/           # Electron 主进程 / preload
├── scripts/
│   ├── edge-tts-server.mjs          # TTS HTTP 服务（可 CLI / 可被 Electron import）
│   └── generate-china48-phonemes.py # 音素音频批处理（可选）
├── public/phonemes/    # 48 音标 MP3 + 归属说明
├── src/
│   ├── components/     # UI 组件
│   ├── data/           # 词表、音素映射、拼读规则等
│   ├── db/             # Dexie schema 与仓储
│   ├── domain/         # 清洗、切分、音形对齐、练习生成等纯逻辑
│   ├── pages/          # 路由页面
│   └── services/       # OCR / IPA / 语音
├── docs/               # PRD 等文档
├── dev.sh              # 一键杀旧进程并启动 Vite + TTS
└── package.json
```

---

## 常见问题

**Q: 整词没声音？**  
A: 确认 TTS 进程在跑（`./dev.sh` 或 Electron 主进程）、本机能访问外网；或看控制台是否回退到 Web Speech。

**Q: 单词详情里点音标片段没声，音标库却有声？**  
A: 旧版本在嵌套路由下相对路径会错；请使用当前代码（根路径 `/phonemes/...`）并重新构建。

**Q: OCR 不准？**  
A: 印刷体英文较好；复杂版式、手写、强阴影请配合手动补录。

**Q: 可以部署到 Vercel 吗？**  
A: 静态前端可以；Edge TTS 需要可运行 Node 的代理或改为预生成音频 / 官方 TTS。Electron 桌面端不依赖 Vercel。

**Q: 支持 iOS / Windows 安装包吗？**  
A: 当前桌面打包目标为 **macOS arm64 + x64**。Web 可在其它系统浏览器中使用（能力受浏览器与 TTS 部署方式影响）。

---

## 贡献

欢迎 Issue 与 Pull Request。

建议：

1. 先开 Issue 讨论较大改动  
2. 保持类型检查与 `npm test` 通过  
3. 音素音频、第三方内容请附带清晰归属，勿提交无授权素材  
4. 不要提交 `node_modules/`、`dist/`、`release/`、本地 `.env`  

本地常用命令：

```bash
npm test
npm run lint
npm run build
```

---

## 致谢

- 48 音标教学录音整理与接入（见 [`public/phonemes/ATTRIBUTION.md`](public/phonemes/ATTRIBUTION.md)）  
- [Tesseract.js](https://github.com/naptha/tesseract.js) · [Dexie.js](https://dexie.org/) · [node-edge-tts](https://github.com/SchneeHertz/node-edge-tts)  
- 以及 Vite / React / Electron 等开源生态  

---

## 许可证

代码计划以开源许可发布。若仓库根目录尚未放置 `LICENSE` 文件，请在发布前补充（例如 MIT / Apache-2.0 等），并在此节写明许可证名称。

**音频素材** 的授权范围以 `public/phonemes/ATTRIBUTION.md` 为准，可能与代码许可证不同；二次分发前请单独确认。

**Edge TTS** 依赖微软面向 Edge 的在线能力，社区封装无官方 SLA，商用或高并发场景请自行评估合规与稳定性，或改用 Azure Speech 等正式服务。

---

## 免责声明

本项目为教学辅助工具，音标与音形对应结果仅供学习参考，不构成专业语言学或教材权威结论。使用 OCR、在线 TTS 等能力时，请遵守相关服务条款与当地法律法规。
