export interface IpaResult {
  ipa: string
  syllables: string | null
  source: 'builtin' | 'api' | 'none'
}

export interface IpaProvider {
  lookup(word: string): Promise<IpaResult>
}
