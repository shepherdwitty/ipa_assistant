/**
 * 将 IPA 字符串切分为音标片段序列（教学向，非严格语言学切分）。
 * 输入可带或不带斜线，如 /fəʊn/ 或 fəʊn
 */
/** 去掉 IPA 定界符与空白。斜杠从不参与发音，全部剥离（避免 /f/ 被误解析）。 */
export function stripIpaSlashes(ipa: string): string {
  return ipa
    .trim()
    // 普通/、全角／、分数字线⁄、方括号等定界符
    .replace(/[/／⁄\[\]]/g, '')
    .replace(/\s+/g, '')
}

/** 常见多字符 IPA 单元（长者优先） */
const MULTI_PHONEMES = [
  'tʃ',
  'dʒ',
  'aɪ',
  'aʊ',
  'eɪ',
  'eə',
  'ɪə',
  'ʊə',
  'ɔɪ',
  'əʊ',
  'oʊ',
  'ɑː',
  'ɔː',
  'iː',
  'uː',
  'ɜː',
  'eː',
  'æ',
  'ʃ',
  'ʒ',
  'θ',
  'ð',
  'ŋ',
  'ɡ',
]

/** 非音素字符：装饰/空白，切分时跳过 */
const SKIP_CHARS = /[ˈˌ.\s\-ʰʲʷˠˤʼ]/

export function splitPhonemes(ipaFull: string): string[] {
  const raw = stripIpaSlashes(ipaFull)
  const result: string[] = []
  let i = 0

  while (i < raw.length) {
    const ch = raw[i]

    // 长音并入前一单元
    if (ch === 'ː') {
      if (result.length > 0) {
        result[result.length - 1] = result[result.length - 1] + 'ː'
      }
      i += 1
      continue
    }

    // 跳过重音、送气上标等（ʰ 不是独立音标）
    if (SKIP_CHARS.test(ch) || ch.charCodeAt(0) >= 0x0300 && ch.charCodeAt(0) <= 0x036f) {
      i += 1
      continue
    }

    let matched = false
    for (const unit of MULTI_PHONEMES) {
      if (raw.startsWith(unit, i)) {
        result.push(unit)
        i += unit.length
        matched = true
        break
      }
    }
    if (matched) continue

    // 单字符 + 可选长音
    let unit = raw[i]
    i += 1
    if (raw[i] === 'ː') {
      unit += 'ː'
      i += 1
    }
    // 跳过空/纯修饰碎片
    if (unit && !SKIP_CHARS.test(unit)) {
      result.push(unit)
    }
  }

  return result
}

export function formatPhoneme(phoneme: string): string {
  return `/${phoneme}/`
}

export function normalizePhonemeQuery(input: string): string {
  return stripIpaSlashes(input)
}
