import { describe, expect, it } from 'vitest'
import { arpabetToIpa } from './arpabetToIpa'

describe('arpabetToIpa', () => {
  it('converts project-like pronunciation', () => {
    const ipa = arpabetToIpa('pron:P R AA1 JH EH0 K T')
    expect(ipa).toContain('p')
    expect(ipa).toContain('dʒ')
    expect(ipa.startsWith('/')).toBe(true)
  })
})
