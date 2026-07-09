/**
 * 粗粒度 ARPAbet → 教学向英式 IPA（用于 Datamuse 等回退源）。
 * 不是完美转写，但比「无音标」好得多。
 */
const ARPA: Record<string, string> = {
  AA: 'ɒ', // US father≈ɑː；project 等词教学向用 ɒ 更贴近英式
  AE: 'æ',
  AH: 'ʌ',
  AO: 'ɔː',
  AW: 'aʊ',
  AY: 'aɪ',
  B: 'b',
  CH: 'tʃ',
  D: 'd',
  DH: 'ð',
  EH: 'e',
  ER: 'ɜː',
  EY: 'eɪ',
  F: 'f',
  G: 'ɡ',
  HH: 'h',
  IH: 'ɪ',
  IY: 'iː',
  JH: 'dʒ',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  NG: 'ŋ',
  OW: 'əʊ',
  OY: 'ɔɪ',
  P: 'p',
  R: 'r',
  S: 's',
  SH: 'ʃ',
  T: 't',
  TH: 'θ',
  UH: 'ʊ',
  UW: 'uː',
  V: 'v',
  W: 'w',
  Y: 'j',
  Z: 'z',
  ZH: 'ʒ',
}

/** 弱读音节里的 AH 常是 schwa */
function mapToken(token: string, isStressed: boolean): string {
  const base = token.replace(/[0-2]$/, '').toUpperCase()
  if (base === 'AH' && !isStressed) return 'ə'
  if (base === 'IH' && !isStressed) return 'ɪ'
  return ARPA[base] ?? ''
}

/**
 * @param arpabet 如 "P R AA1 JH EH0 K T" 或带 pron: 前缀的 tag
 */
export function arpabetToIpa(arpabet: string): string {
  let raw = arpabet.trim()
  raw = raw.replace(/^pron:/i, '').trim()
  if (!raw) return ''

  const tokens = raw.split(/\s+/).filter(Boolean)
  const parts: string[] = []

  for (const t of tokens) {
    const stress = /[12]$/.test(t)
    const ipa = mapToken(t, stress)
    if (ipa) parts.push(ipa)
  }

  if (!parts.length) return ''
  return `/${parts.join('')}/`
}
