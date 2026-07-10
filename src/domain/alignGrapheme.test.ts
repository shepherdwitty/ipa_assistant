import { describe, expect, it } from 'vitest'
import { alignGraphemePhoneme, findGraphemeForPhoneme } from './alignGrapheme'

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
})
