# Phoneme audio attribution（China-48 音库）

本目录为 **中国英语教学 48 个国际音标** 本地录音，供 App 单音素点击播放。

## 当前音源

| 项 | 说明 |
|----|------|
| **来源** | Amy英语徐老师 教学录音（作者本人） |
| **整理** | 自 `yb/` 目录 48 个 `.M4A` 映射转码接入 |
| **格式** | 单声道 44.1 kHz MP3（ffmpeg 去静音 + loudnorm） |
| **覆盖** | 12 单元音 + 8 双元音 + 28 辅音（含 ts/dz/tr/dr） |

音质为真人教学发音，双元音 / 破擦音为整段录音（不串播两个音素）。

## 文件名约定

ASCII 文件名，避免 macOS 大小写冲突：

- `tʃ` → `ch.mp3`
- `dʒ` → `jh.mp3`
- `ts` / `dz` / `tr` / `dr` → 同名 `ts.mp3` 等
- 长/短元音等见 `src/data/phoneme-audio-map.ts`

## 历史

- 曾使用 Wikimedia Commons 混杂 IPA 样本、Edge TTS 合成等方案，已替换。
- 旧文件备份可能位于 `_backup_*` 目录（本地，可不纳入版本库）。
