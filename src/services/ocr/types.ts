import type { CandidateWord } from '../../db/schema'

export type OcrProgressStage = 'loading' | 'recognizing' | 'done' | 'error'

export interface OcrProgress {
  stage: OcrProgressStage
  progress: number
  message: string
}

export interface OcrResult {
  rawText: string
  candidates: CandidateWord[]
}

export interface OcrProvider {
  recognize(
    image: Blob | File | string,
    onProgress?: (p: OcrProgress) => void,
  ): Promise<OcrResult>
}
