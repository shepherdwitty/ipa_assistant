import { NavLink, Outlet } from 'react-router-dom'

const nav = [
  { to: '/', label: '导入', end: true },
  { to: '/library', label: '词库', end: false },
  { to: '/practice', label: '练习', end: false },
]

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition',
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:bg-slate-50',
  ].join(' ')
}

export function Layout() {
  return (
    <div className="min-h-dvh bg-surface md:bg-slate-100/80">
      {/*
        手机：max-w-lg 居中卡片
        iPad：max-w-3xl
        桌面：max-w-5xl
      */}
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white shadow-sm md:max-w-3xl md:shadow-md lg:max-w-5xl xl:max-w-6xl">
        <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
                IPA
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-900">音标小助手</h1>
                <p className="truncate text-xs text-slate-500">
                  拍照建库 · 音形对照讲解
                </p>
              </div>
            </div>

            {/* iPad / Web：顶部导航 */}
            <nav className="hidden md:block" aria-label="主导航">
              <ul className="flex items-center gap-1">
                {nav.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.end} className={navClassName}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        {/* 手机留底部导航空间；平板/桌面无底栏，用正常 padding */}
        <main
          id="app-scroll"
          className="flex-1 overflow-y-auto px-4 py-4 pb-24 md:px-6 md:pb-8 lg:px-8"
        >
          <Outlet />
        </main>

        {/* 仅手机显示底部 Tab */}
        <nav
          className="fixed bottom-0 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 border-t border-slate-100 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="底部导航"
        >
          <ul className="grid grid-cols-3 gap-1 py-2">
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navClassName}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
