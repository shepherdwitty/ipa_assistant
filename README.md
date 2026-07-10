# 音标小助手（IPA Kids）

面向家长/老师的 **H5 儿童国际音标识读辅助工具**。

核心闭环：

`拍照/上传图片 → OCR 提词 → 人工轻校对 → 英式 IPA 建库 → 按音标反查 → 字母组合与音标成对展示 → 轻量练习`

产品需求见 [`docs/2026-07-10-ipa-tool-prd.md`](docs/2026-07-10-ipa-tool-prd.md)。

## 技术栈

- Vite + React 19 + TypeScript
- React Router
- Tailwind CSS v4
- Dexie（IndexedDB 本地词库）
- Tesseract.js（浏览器端 OCR）
- 内置英式 IPA 词表 + Free Dictionary API 回退
- Electron（macOS 桌面端，arm64 + x64）
- Edge TTS（`node-edge-tts`，整词朗读）

## 本地开发

```bash
npm install
./dev.sh          # 浏览器：Vite + TTS
# 或
npm run dev
```

```bash
npm run dev:electron   # 桌面壳：Vite + Electron（主进程内嵌 TTS）
```

```bash
npm test           # 领域逻辑单测
npm run build      # 仅 Web 生产构建
npm run build:mac  # 打 Mac 安装包（arm64 + Intel x64 dmg/zip）→ release/
```

## 功能入口

| 路径 | 说明 |
|------|------|
| `/` | 拍照/上传导入、手动补录 |
| `/review/:importId` | 识别校对 |
| `/library` | 词库 / 音标库反查 |
| `/word/:wordId` | 单词音形拆解 |
| `/practice` | 音标找词、拆解配对、规律卡片 |

## 说明

- **无账号**：数据保存在浏览器 IndexedDB，清除站点数据会丢失。
- **音形对应**为教学向启发式映射，UI 使用「最相关字母组合」表述，不承诺语言学绝对精确。
- OCR 为浏览器端 Tesseract，印刷体英文效果较好；复杂版式请配合手动补录。
- **音标发音**：单音素使用 `public/phonemes/` 下 **Amy 教学 48 音标**录音（见 `ATTRIBUTION.md`）；**整词**优先走本地 Edge TTS（`node-edge-tts` → mp3），失败再回退系统 Web Speech。需联网合成；缓存落在本机。
- **开发端口**：默认 **Web `17321` / TTS `17322`**（`WEB_PORT` / `TTS_PORT` 可覆盖）。
- **桌面端**：Electron 内嵌 TTS；生产包用本地 HTTP 同源托管 `dist` + `/api/tts`。安装包默认**未签名**（本机可右键打开）；正式分发需 Apple 开发者公证。
