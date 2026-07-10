import { describe, expect, it } from 'vitest'
import { alignGraphemePhoneme, findGraphemeForPhoneme } from './alignGrapheme'
import { normalizeTeachingIpa } from './normalizeIpa'
import { splitPhonemes } from './phonemeSplit'

describe('alignGraphemePhoneme', () => {
  it('maps ph to f in phone', () => {
    const units = alignGraphemePhoneme('phone', '/fəʊn/')
    const ph = units.find((u) => u.grapheme === 'ph')
    expect(ph?.phoneme).toBe('f')
    const forF = findGraphemeForPhoneme(units, 'f')
    expect(forF?.grapheme).toBe('ph')
  })

  it('maps sh in ship', () => {
    const units = alignGraphemePhoneme('ship', '/ʃɪp/')
    expect(units.some((u) => u.grapheme === 'sh' && u.phoneme === 'ʃ')).toBe(true)
  })

  it('maps wanted without treating aspiration as a phoneme', () => {
    const units = alignGraphemePhoneme('wanted', '/wɒntʰɪd/')
    expect(units.some((u) => u.phoneme.includes('ʰ'))).toBe(false)
    expect(units.some((u) => u.grapheme === 'ed' && u.phoneme === 'ɪd')).toBe(true)
    expect(units.find((u) => u.grapheme === 'w')?.phoneme).toBe('w')
    expect(units.find((u) => u.grapheme === 'a')?.phoneme).toBe('ɒ')
  })

  it('maps China-48 tr/dr as single teaching units', () => {
    const tree = alignGraphemePhoneme('tree', '/triː/')
    expect(tree.some((u) => u.grapheme === 'tr' && u.phoneme === 'tr')).toBe(true)
    expect(tree.some((u) => u.grapheme === 'ee' && u.phoneme === 'iː')).toBe(true)

    const drink = alignGraphemePhoneme('drink', '/drɪŋk/')
    expect(drink.some((u) => u.grapheme === 'dr' && u.phoneme === 'dr')).toBe(true)
  })

  it('aligns appointee without dumping residual phonemes onto pp', () => {
    const units = alignGraphemePhoneme('appointee', '/əpɔɪntiː/')
    expect(units.find((u) => u.grapheme === 'a')?.phoneme).toBe('ə')
    expect(units.find((u) => u.grapheme === 'pp')?.phoneme).toBe('p')
    expect(units.find((u) => u.grapheme === 'oi')?.phoneme).toBe('ɔɪ')
    expect(units.find((u) => u.grapheme === 'n')?.phoneme).toBe('n')
    expect(units.find((u) => u.grapheme === 't')?.phoneme).toBe('t')
    expect(units.find((u) => u.grapheme === 'ee')?.phoneme).toBe('iː')
    // 不允许 pp 吞掉后续整串音标
    expect(units.find((u) => u.grapheme === 'pp')?.phoneme).not.toMatch(/ɔɪ/)
  })

  it('aligns appointee after Free Dictionary-style oɪ IPA is normalized', () => {
    // 模拟完整链路：API raw → normalize → align
    const ipa = normalizeTeachingIpa('/əˌpoɪnˈtiː/')
    const units = alignGraphemePhoneme('appointee', ipa)
    expect(units.map((u) => `${u.grapheme}/${u.phoneme}`)).toEqual([
      'a/ə',
      'pp/p',
      'oi/ɔɪ',
      'n/n',
      't/t',
      'ee/iː',
    ])
  })

  it('aligns comment without dumping residual phonemes onto mm', () => {
    // Free Dictionary: /ˈkɒmɛnt/ —— ɛ 若未归一为 e，旧算法会把 ɛnt 并进 mm
    const ipa = normalizeTeachingIpa('/ˈkɒmɛnt/')
    const units = alignGraphemePhoneme('comment', ipa)
    expect(units.map((u) => `${u.grapheme}/${u.phoneme}`)).toEqual([
      'c/k',
      'o/ɒ',
      'mm/m',
      'e/e',
      'n/n',
      't/t',
    ])
    expect(units.find((u) => u.grapheme === 'mm')?.phoneme).toBe('m')
  })

  it('aligns history without t swallowing (ə)ri', () => {
    // Free Dictionary: /ˈhɪst(ə)ɹi/
    const ipa = normalizeTeachingIpa('/ˈhɪst(ə)ɹi/')
    const units = alignGraphemePhoneme('history', ipa)
    expect(units.find((u) => u.grapheme === 't')?.phoneme).toBe('t')
    expect(units.find((u) => u.grapheme === 'or')?.phoneme).toBe('ər')
    expect(units.find((u) => u.grapheme === 'y')?.phoneme).toBe('i')
    expect(units.find((u) => u.grapheme === 't')?.phoneme).not.toMatch(/[()ə]/)
  })

  it('aligns receive with ei → iː (not three loose e letters)', () => {
    const ipa = normalizeTeachingIpa('/ɹɪˈsiːv/')
    const units = alignGraphemePhoneme('receive', ipa)
    expect(units.map((u) => `${u.grapheme}/${u.phoneme || '∅'}`)).toEqual([
      'r/r',
      'e/ɪ',
      'c/s',
      'ei/iː',
      'v/v',
      'e/∅',
    ])
  })

  it('aligns activity letter-by-letter without swallowing', () => {
    const ipa = normalizeTeachingIpa('/ækˈtɪ.və.ti/')
    const units = alignGraphemePhoneme('activity', ipa)
    expect(units.find((u) => u.grapheme === 'a')?.phoneme).toBe('æ')
    expect(units.find((u) => u.grapheme === 'c')?.phoneme).toBe('k')
    // 第一个 i → ɪ（重读音节）
    expect(units.filter((u) => u.grapheme === 'i').map((u) => u.phoneme)).toEqual(['ɪ', 'ə'])
    expect(units.find((u) => u.grapheme === 'y')?.phoneme).toBe('i')
  })

  it('never dumps multi-phoneme residue onto a single letter (regression suite)', () => {
    const cases: Array<[string, string]> = [
      ['appointee', '/əˌpoɪnˈtiː/'],
      ['comment', '/ˈkɒmɛnt/'],
      ['history', '/ˈhɪst(ə)ɹi/'],
      ['receive', '/ɹɪˈsiːv/'],
      ['activity', '/ækˈtɪ.və.ti/'],
      ['phone', '/fəʊn/'],
    ]
    for (const [word, raw] of cases) {
      const units = alignGraphemePhoneme(word, normalizeTeachingIpa(raw))
      for (const u of units) {
        // 核心不变量：禁止 t→/t(ə)ri/、pp→/pɔɪntiː/ 形态
        if (u.grapheme.length === 1 && u.phoneme) {
          expect(
            splitPhonemes(u.phoneme).length,
            `${word}: ${u.grapheme}->/${u.phoneme}/`,
          ).toBeLessThanOrEqual(1)
        }
        expect(u.phoneme).not.toMatch(/[()]/)
      }
      // 有音单元的音标拼接应覆盖整词音标（静音字母除外）
      const joined = units.map((u) => u.phoneme).join('')
      const expected = normalizeTeachingIpa(raw).replace(/\//g, '')
      expect(joined, word).toBe(expected)
    }
  })
})
