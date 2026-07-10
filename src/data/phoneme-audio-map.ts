/**
 * 中国英语教学 48 个国际音标 → 本地录音（public/phonemes/）
 *
 * 音源：Amy英语徐老师 教学录音（yb/ 下 48 个 M4A 映射转码）
 * 说明：public/phonemes/ATTRIBUTION.md
 * 覆盖：12 单元音 + 8 双元音 + 28 辅音（含教材 ts/dz/tr/dr）
 * 双元音 / 破擦音均为整段文件，不拆串播。
 */

/** 单音素 → 文件名（ASCII，位于 /phonemes/） */
export const PHONEME_AUDIO_FILE: Record<string, string> = {
  // ---------- 12 单元音 ----------
  iː: 'i.mp3',
  i: 'i.mp3',
  ɪ: 'small_cap_i.mp3',
  e: 'e.mp3',
  ɛ: 'e.mp3',
  eː: 'e.mp3',
  æ: 'ae.mp3',
  ɑː: 'aa.mp3',
  ɑ: 'aa.mp3',
  a: 'aa.mp3',
  ɒ: 'oopen.mp3',
  ɔː: 'openo.mp3',
  ɔ: 'openo.mp3',
  ʊ: 'upsilon.mp3',
  uː: 'u.mp3',
  u: 'u.mp3',
  ʌ: 'strut.mp3',
  ɜː: 'rev_epsilon.mp3',
  ɜ: 'rev_epsilon.mp3',
  ə: 'schwa.mp3',

  // ---------- 8 双元音（整段连续，不拆播）----------
  eɪ: 'ei.mp3',
  aɪ: 'ai.mp3',
  ɔɪ: 'oi.mp3',
  əʊ: 'ou.mp3',
  oʊ: 'ou.mp3',
  o: 'ou.mp3',
  aʊ: 'au.mp3',
  ɪə: 'ia.mp3',
  eə: 'ea.mp3',
  ʊə: 'ua.mp3',

  // ---------- 28 辅音（中国教材 48 音标）----------
  p: 'p.mp3',
  b: 'b.mp3',
  t: 't.mp3',
  d: 'd.mp3',
  k: 'k.mp3',
  ɡ: 'g.mp3',
  g: 'g.mp3',
  f: 'f.mp3',
  v: 'v.mp3',
  θ: 'th.mp3',
  ð: 'dh.mp3',
  s: 's.mp3',
  z: 'z.mp3',
  ʃ: 'sh.mp3',
  ʒ: 'zh.mp3',
  h: 'h.mp3',
  // 文件名避免仅大小写不同（macOS 默认不区分大小写）
  tʃ: 'ch.mp3',
  dʒ: 'jh.mp3',
  // 教材扩展：破擦/辅音连缀
  ts: 'ts.mp3',
  dz: 'dz.mp3',
  tr: 'tr.mp3',
  dr: 'dr.mp3',
  m: 'm.mp3',
  n: 'n.mp3',
  ŋ: 'ng.mp3',
  l: 'l.mp3',
  r: 'r.mp3',
  ɹ: 'r.mp3',
  j: 'j.mp3',
  w: 'w.mp3',
}

/**
 * 双元音串播兜底（仅当整段文件缺失时使用）
 */
export const DIPHTHONG_SEQUENCE: Record<string, string[]> = {
  eɪ: ['e', 'i'],
  aɪ: ['a', 'i'],
  ɔɪ: ['ɔ', 'i'],
  əʊ: ['ə', 'ʊ'],
  oʊ: ['o', 'ʊ'],
  aʊ: ['a', 'u'],
  ɪə: ['ɪ', 'ə'],
  eə: ['e', 'ə'],
  ʊə: ['ʊ', 'ə'],
}

/** 中国 48 音标标准列表（展示/校验用） */
export const CHINA_48_PHONEMES: readonly string[] = [
  // 单元音 12
  'iː',
  'ɪ',
  'e',
  'æ',
  'ɑː',
  'ɒ',
  'ɔː',
  'ʊ',
  'uː',
  'ʌ',
  'ɜː',
  'ə',
  // 双元音 8
  'eɪ',
  'aɪ',
  'ɔɪ',
  'əʊ',
  'aʊ',
  'ɪə',
  'eə',
  'ʊə',
  // 辅音 28
  'p',
  'b',
  't',
  'd',
  'k',
  'ɡ',
  'f',
  'v',
  'θ',
  'ð',
  's',
  'z',
  'ʃ',
  'ʒ',
  'h',
  'tʃ',
  'dʒ',
  'ts',
  'dz',
  'tr',
  'dr',
  'm',
  'n',
  'ŋ',
  'l',
  'r',
  'j',
  'w',
] as const

/**
 * 音素 mp3 URL。必须是「站点根」路径，不能依赖 BASE_URL=./ 的相对路径：
 * 否则在 /word/:id 等嵌套路由下会错误解析成 /word/phonemes/xxx.mp3。
 */
export function getPhonemeAudioUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/'
  // './' 或 '.' 仅适合入口资源；public 音素一律按宿主根路径取
  if (base === './' || base === '.' || base === '') {
    return `/phonemes/${file}`
  }
  const prefix = base.endsWith('/') ? base : `${base}/`
  // 已是绝对 http(s) 时直接拼；否则保证以 / 开头的根相对路径
  if (/^https?:\/\//i.test(prefix)) {
    return `${prefix}phonemes/${file}`
  }
  const root = prefix.startsWith('/') ? prefix : `/${prefix}`
  return `${root}phonemes/${file}`.replace(/\/{2,}/g, '/')
}

/** 校验：48 音标是否都有音频映射 */
export function assertChina48Coverage(): string[] {
  return CHINA_48_PHONEMES.filter((p) => !PHONEME_AUDIO_FILE[p])
}
