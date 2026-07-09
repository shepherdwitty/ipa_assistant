/**
 * 将词典/API 返回的 IPA 归一化为「儿童英式教学」常用写法。
 *
 * 常见易混符号：
 * - ɹ / ɻ：学术上的英语 r，教材几乎一律写成 r
 * - ɚ / ɝ：美式卷舌元音，英式无对应，降为 ə / ɜː
 * - oʊ：美式 go，英式作 əʊ
 * - ɫ ɫ̩ 等附属符号：去掉，避免界面噪音
 */
export function normalizeTeachingIpa(raw: string): string {
  if (!raw) return raw

  let s = raw.trim()
  // 统一分隔符：方括号 → 斜线
  s = s.replace(/^\[/, '/').replace(/\]$/, '/')
  if (!s.startsWith('/')) s = `/${s}`
  if (!s.endsWith('/')) s = `${s}/`

  let body = s.slice(1, -1)

  // 去掉音节/重音等可选装饰（儿童教学不需要）
  body = body
    .replace(/[ˈˌ.]/g, '')
    .replace(/[\u0300-\u036f]/g, '') // 组合变音（送气、鼻化等）
    // 上标修饰：ʰ 送气、ʲ 腭化、ʷ 圆唇等 —— 不是独立音素
    .replace(/[ʰʲʷˠˤʼ]/g, '')
    .replace(/[̩̯̥̬̹̜̃]/g, '')

  // r 类符号 → 普通 r（用户反馈的「倒过来的 r」）
  body = body.replace(/[ɹɻʀʁɾ]/g, 'r')

  // 美式 r 色彩元音
  body = body.replace(/ɝː?/g, 'ɜː')
  body = body.replace(/ɚː?/g, 'ə')

  // 美式双元音倾向
  body = body.replace(/oʊ/g, 'əʊ')
  body = body.replace(/ɑ(?![ːa])/g, 'ɑː') // 松散：孤立 ɑ 常见于美式 father

  // g 统一
  body = body.replace(/g/g, 'ɡ')

  // 清理多余空白
  body = body.replace(/\s+/g, '')

  return `/${body}/`
}
