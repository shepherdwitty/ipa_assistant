import Tesseract from 'tesseract.js'
import { extractWordsFromText } from '../../domain/wordClean'
import type { OcrProvider, OcrResult } from './types'

/** 压缩过大图片，提升移动端 OCR 速度 */
async function prepareImage(image: Blob | File | string): Promise<Blob | File | string> {
  if (typeof image === 'string') return image
  if (image.size < 800_000) return image

  try {
    const bitmap = await createImageBitmap(image)
    const maxW = 1600
    const scale = bitmap.width > maxW ? maxW / bitmap.width : 1
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return image
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    )
    return blob ?? image
  } catch {
    return image
  }
}

function collectWordConfidences(page: Tesseract.Page): Map<string, number> {
  const confidences = new Map<string, number>()
  for (const block of page.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          const text = word.text?.trim().toLowerCase()
          if (!text) continue
          const conf = (word.confidence ?? 0) / 100
          const prev = confidences.get(text)
          if (prev === undefined || conf > prev) confidences.set(text, conf)
        }
      }
    }
  }
  return confidences
}

export const tesseractOcr: OcrProvider = {
  async recognize(image, onProgress): Promise<OcrResult> {
    onProgress?.({ stage: 'loading', progress: 0.05, message: '正在加载识别引擎…' })
    const prepared = await prepareImage(image)

    const result = await Tesseract.recognize(prepared, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress?.({
            stage: 'recognizing',
            progress: 0.1 + (m.progress ?? 0) * 0.85,
            message: '正在提取英文内容…',
          })
        } else if (m.status === 'loading language traineddata') {
          onProgress?.({
            stage: 'loading',
            progress: 0.08,
            message: '正在加载语言包…',
          })
        }
      },
    })

    const rawText = result.data.text ?? ''
    const confidences = collectWordConfidences(result.data)
    const candidates = extractWordsFromText(rawText, confidences)
    onProgress?.({ stage: 'done', progress: 1, message: '识别完成' })
    return { rawText, candidates }
  },
}
