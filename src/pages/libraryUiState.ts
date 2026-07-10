/** 词库页 UI 状态：Tab / 搜索 / 选中音标 / 各 Tab 滚动位置（session 内记住） */

export type LibraryTab = 'words' | 'phonemes'

export type LibraryUiState = {
  tab: LibraryTab
  query: string
  activePhoneme: string | null
  /** 每个 Tab 各自的滚动高度 */
  scrollByTab: Partial<Record<LibraryTab, number>>
}

const STORAGE_KEY = 'ipa-library-ui-v1'

const DEFAULT_STATE: LibraryUiState = {
  tab: 'phonemes',
  query: '',
  activePhoneme: null,
  scrollByTab: {},
}

export function loadLibraryUi(): LibraryUiState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_STATE, scrollByTab: {} }
    const parsed = JSON.parse(raw) as Partial<LibraryUiState>
    const tab: LibraryTab = parsed.tab === 'words' ? 'words' : 'phonemes'
    return {
      tab,
      query: typeof parsed.query === 'string' ? parsed.query : '',
      activePhoneme:
        typeof parsed.activePhoneme === 'string' ? parsed.activePhoneme : null,
      scrollByTab: {
        phonemes: Number(parsed.scrollByTab?.phonemes) || 0,
        words: Number(parsed.scrollByTab?.words) || 0,
      },
    }
  } catch {
    return { ...DEFAULT_STATE, scrollByTab: {} }
  }
}

export function saveLibraryUi(patch: Partial<LibraryUiState>): void {
  try {
    const prev = loadLibraryUi()
    const next: LibraryUiState = {
      tab: patch.tab ?? prev.tab,
      query: patch.query ?? prev.query,
      activePhoneme:
        patch.activePhoneme !== undefined ? patch.activePhoneme : prev.activePhoneme,
      scrollByTab: {
        ...prev.scrollByTab,
        ...(patch.scrollByTab ?? {}),
      },
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota — ignore */
  }
}

export function getAppScrollRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return (
    document.getElementById('app-scroll') ??
    document.querySelector('main')
  )
}

export function readScrollTop(): number {
  return getAppScrollRoot()?.scrollTop ?? 0
}

export function writeScrollTop(top: number): void {
  const el = getAppScrollRoot()
  if (el) el.scrollTop = top
}
