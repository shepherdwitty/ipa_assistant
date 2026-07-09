/**
 * 英式教学音素 → 本地录音文件（public/phonemes/）
 *
 * 音频来源：Wikimedia Commons IPA 示例录音
 * 许可：Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)
 * 整理参考：joshstephenson/PhoneticFlashCards 等对 Commons 的汇集
 *
 * 注：录音为国际音素示例，非商业教材级 RP；但远优于 TTS 硬念 IPA。
 */

/** 单音素 → 文件名（ASCII，位于 /phonemes/） */
export const PHONEME_AUDIO_FILE: Record<string, string> = {
  // 辅音
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
  tʃ: 'tS.mp3',
  dʒ: 'dZ.mp3',
  m: 'm.mp3',
  n: 'n.mp3',
  ŋ: 'ng.mp3',
  l: 'l.mp3',
  r: 'r.mp3',
  ɹ: 'r.mp3',
  j: 'j.mp3',
  w: 'w.mp3',
  // 单元音（长音共用短音录音）
  iː: 'i.mp3',
  i: 'i.mp3',
  ɪ: 'small_cap_i.mp3',
  e: 'e.mp3',
  ɛ: 'open_e.mp3',
  æ: 'ae.mp3',
  ɑː: 'aa.mp3',
  ɑ: 'aa.mp3',
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
  eː: 'e.mp3',
  o: 'o.mp3',
  a: 'a.mp3',
  // 双元音：整段连续录音（一次播放，不拆成两个单音）
  eɪ: 'ei.mp3',
  aɪ: 'ai.mp3',
  ɔɪ: 'oi.mp3',
  əʊ: 'ou.mp3',
  oʊ: 'ou.mp3',
  aʊ: 'au.mp3',
  ɪə: 'ia.mp3',
  eə: 'ea.mp3',
  ʊə: 'ua.mp3',
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

export function getPhonemeAudioUrl(file: string): string {
  // Vite public 目录
  return `${import.meta.env.BASE_URL}phonemes/${file}`
}
