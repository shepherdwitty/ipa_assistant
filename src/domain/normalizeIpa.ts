/**
 * 将词典/API 返回的 IPA 归一化为「中国教材 48 音标 / 儿童英式教学」写法。
 *
 * 设计原则（一劳永逸方向）：
 * 1. 先剥装饰（重音、可选括号、送气等）
 * 2. 再按「长者优先」替换多字符变体
 * 3. 最后单字符变体表 → 教学库存音标
 *
 * 对齐算法只认识归一化后的库存；新见变体应补进本表，而不是在 align 里打补丁。
 */

/** 多字符：长者优先（先写更长的键） */
const MULTI_VARIANTS: Array<[string, string]> = [
  // 美式 / 学术双元音 → 教学
  ['oʊ', 'əʊ'],
  ['ow', 'əʊ'], // 极少数字符串源
  ['oɪ', 'ɔɪ'],
  ['ɔi', 'ɔɪ'],
  ['aɪ', 'aɪ'],
  ['ai', 'aɪ'],
  ['aʊ', 'aʊ'],
  ['au', 'aʊ'],
  ['eɪ', 'eɪ'],
  ['ei', 'eɪ'],
  ['eə', 'eə'],
  ['ɛə', 'eə'],
  ['ɪə', 'ɪə'],
  ['iə', 'ɪə'],
  ['ʊə', 'ʊə'],
  ['uə', 'ʊə'],
  // 破擦 / 中国 48
  ['tʃ', 'tʃ'],
  ['t͡ʃ', 'tʃ'],
  ['ʧ', 'tʃ'],
  ['dʒ', 'dʒ'],
  ['d͡ʒ', 'dʒ'],
  ['ʤ', 'dʒ'],
  // 长元音写法变体
  ['i:', 'iː'],
  ['u:', 'uː'],
  ['a:', 'ɑː'],
  ['ɑ:', 'ɑː'],
  ['ɔ:', 'ɔː'],
  ['ɜ:', 'ɜː'],
  ['o:', 'ɔː'],
]

/** 单字符：学术/美式 → 教学 48 */
const CHAR_VARIANTS: Record<string, string> = {
  // r 类
  ɹ: 'r',
  ɻ: 'r',
  ʀ: 'r',
  ʁ: 'r',
  ɾ: 'r',
  // 元音
  ɛ: 'e', // dress：教材写作 e
  ɐ: 'ʌ', // strut 一带
  ɨ: 'ɪ',
  ɘ: 'ə',
  ɵ: 'ə',
  ɤ: 'ə',
  ɩ: 'ɪ',
  ɷ: 'ʊ',
  ʏ: 'ɪ',
  // 美式 r 色彩（若前面多字符未吃掉）
  ɚ: 'ə',
  ɝ: 'ɜː',
  // 辅音
  g: 'ɡ', // ASCII g → IPA ɡ
  ɫ: 'l', // dark l
  ɬ: 'l',
  ɲ: 'n',
  ɳ: 'n',
  ŋ̊: 'ŋ',
  ʔ: '', // 喉塞：教学省略
  ʍ: 'w',
  // 长音标记统一
  ':': 'ː',
}

export function normalizeTeachingIpa(raw: string): string {
  if (!raw) return raw

  let s = raw.trim()
  // 统一分隔符：方括号 → 斜线
  s = s.replace(/^\[/, '/').replace(/\]$/, '/')
  if (!s.startsWith('/')) s = `/${s}`
  if (!s.endsWith('/')) s = `${s}/`

  let body = s.slice(1, -1)

  // 1) 装饰剥离
  body = body
    .replace(/[ˈˌ.]/g, '')
    .replace(/[\u0300-\u036f]/g, '') // 组合变音
    .replace(/[ʰʲʷˠˤʼ]/g, '') // 上标修饰
    .replace(/[̩̯̥̬̹̜̃]/g, '')

  // 可选音括号：history /ˈhɪst(ə)ri/ → 保留内容
  body = body.replace(/\(([^)]*)\)/g, '$1')
  body = body.replace(/[()[\]⟦⟧]/g, '')

  // 2) 多字符变体（长者优先）
  const multiSorted = [...MULTI_VARIANTS].sort((a, b) => b[0].length - a[0].length)
  for (const [from, to] of multiSorted) {
    if (from === to) continue
    body = body.split(from).join(to)
  }

  // 3) 单字符变体
  let out = ''
  for (const ch of body) {
    if (Object.prototype.hasOwnProperty.call(CHAR_VARIANTS, ch)) {
      out += CHAR_VARIANTS[ch]
    } else {
      out += ch
    }
  }
  body = out

  // 4) r 色彩长音兜底（ɝː 等）
  body = body.replace(/ɝː?/g, 'ɜː')
  body = body.replace(/ɚː?/g, 'ə')

  // 5) 孤立 ɑ → ɑː（美式 father）
  body = body.replace(/ɑ(?!ː)/g, 'ɑː')

  // 6) 空白
  body = body.replace(/\s+/g, '')

  return `/${body}/`
}
