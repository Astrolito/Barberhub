import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { cx } from './ui'
import { ICalendar, IHeart, IHelp, IHome, IInfo, ILogout, IMenu, IScissors, IUser, IWifiOff, IX } from './Icons'

const TABS = [
  { to: '/', label: 'Início', icon: IHome, end: true },
  { to: '/favoritos', label: 'Favoritos', icon: IHeart },
  { to: '/agendamentos', label: 'Agendamentos', icon: ICalendar },
  { to: '/perfil', label: 'Perfil', icon: IUser },
]

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/90 pb-safe backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-[520px] grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cx('press flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150', isActive ? 'text-brand-ink' : 'text-faint hover:text-muted')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={23} strokeWidth={isActive ? 2.1 : 1.7} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Layout das abas principais: cabeçalho com menu + tab bar. */
export function TabsLayout() {
  const [menu, setMenu] = useState(false)
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-line/50 bg-bg/85 px-2 pt-safe backdrop-blur-xl">
        <button aria-label="Abrir menu" onClick={() => setMenu(true)} className="press grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface2">
          <IMenu />
        </button>
        <span className="ml-1 text-[15px] font-bold tracking-tight">
          Barber<span className="text-brand-ink">HUB</span>
        </span>
      </header>
      <Outlet />
      <TabBar />
      {menu && <Drawer onClose={() => setMenu(false)} />}
    </>
  )
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { usuario, sair } = useApp()
  const nav = useNavigate()
  const [closing, setClosing] = useState(false)
  const fechar = (then?: () => void) => {
    setClosing(true)
    setTimeout(() => {
      onClose()
      then?.()
    }, 200)
  }
  const Item = ({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) => (
    <button onClick={() => fechar(() => nav(to))} className="row-press flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15.5px] font-medium">
      <span className="text-brand-ink">{icon}</span>
      {children}
    </button>
  )
  return (
    <div className="fixed inset-0 z-50">
      <div onClick={() => fechar()} className={cx('absolute inset-0 bg-black/60 transition-opacity duration-200', closing ? 'opacity-0' : 'animate-fade-in')} />
      <aside className={cx('absolute inset-y-0 left-0 flex w-[82%] max-w-[320px] flex-col border-r border-line bg-surface px-3 pb-safe pt-safe transition-transform duration-200 ease-out', closing ? '-translate-x-full' : 'animate-drawer-in')}>
        <div className="flex h-14 items-center justify-between px-2">
          <span className="text-[19px] font-bold tracking-tight">
            Barber<span className="text-brand-ink">HUB</span>
          </span>
          <button aria-label="Fechar menu" onClick={() => fechar()} className="press grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted">
            <IX size={18} />
          </button>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5">
          {usuario?.papel === 'Barbeiro' && (
            <Item to="/barbeiro" icon={<IScissors />}>
              {usuario.dono ? 'Área do dono' : 'Área do barbeiro'}
            </Item>
          )}
          <Item to="/ajuda" icon={<IHelp />}>
            Ajuda
          </Item>
          <Item to="/sobre" icon={<IInfo />}>
            Sobre o BarberHUB
          </Item>
        </nav>
        <button
          onClick={() =>
            fechar(async () => {
              await sair()
              nav('/entrar', { replace: true })
            })
          }
          className="row-press mb-4 flex items-center gap-3 rounded-xl px-3 py-3 text-[15.5px] font-medium text-danger"
        >
          <ILogout />
          Sair da conta
        </button>
      </aside>
    </div>
  )
}

export function Toaster() {
  const { toasts } = useApp()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'animate-toast-in pointer-events-auto w-full max-w-[420px] rounded-2xl border px-4 py-3 text-[14.5px] font-medium shadow-2xl shadow-black/50 backdrop-blur-xl',
            t.tipo === 'erro' ? 'border-danger/40 bg-[#2a0f12]/95 text-red-200' : t.tipo === 'info' ? 'border-line bg-surface2/95 text-ink' : 'border-brand/40 bg-[#0d2547]/95 text-blue-100',
          )}
        >
          {t.texto}
        </div>
      ))}
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, pronto, erro } = useApp()
  const loc = useLocation()
  if (!pronto) return <Carregando />
  if (erro && !usuario) return <SemConexao />
  if (!usuario) return <Navigate to="/entrar" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-brand-ink underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}

export function Carregando() {
  return (
    <div className="grid min-h-[100dvh] place-items-center">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <span className="text-[22px] font-bold tracking-tight">
          Barber<span className="text-brand-ink">HUB</span>
        </span>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      </div>
    </div>
  )
}

/** Falha na primeira carga: sem dados para mostrar. */
export function SemConexao() {
  const { erro, recarregar } = useApp()
  const [tentando, setTentando] = useState(false)
  return (
    <div className="grid min-h-[100dvh] place-items-center px-8 text-center">
      <div className="animate-fade-up flex flex-col items-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface2 text-brand-ink">
          <IWifiOff />
        </div>
        <h1 className="mt-4 text-[19px] font-semibold">Não foi possível carregar</h1>
        <p className="mt-1 max-w-[300px] text-[14.5px] leading-5 text-muted">{erro ?? 'Verifique sua internet e tente de novo.'}</p>
        <button
          disabled={tentando}
          onClick={async () => {
            setTentando(true)
            await recarregar()
            setTentando(false)
          }}
          className="press mt-6 h-11 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {tentando ? 'Tentando…' : 'Tentar de novo'}
        </button>
      </div>
    </div>
  )
}

/** Aviso fixo quando o aparelho fica sem internet (os dados na tela podem estar desatualizados). */
export function AvisoOffline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const { recarregar, modo } = useApp()
  useEffect(() => {
    const on = () => {
      setOnline(true)
      if (modo === 'supabase') recarregar()
    }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [recarregar, modo])
  if (online || modo === 'local') return null
  return (
    <div role="status" className="animate-fade-in fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[480px] items-center justify-center gap-2 px-4 pb-2">
      <span className="flex items-center gap-2 rounded-full border border-line bg-surface2/95 px-4 py-2 text-[13.5px] font-medium text-muted shadow-xl backdrop-blur">
        <IWifiOff size={16} /> Sem internet. Mostrando os últimos dados.
      </span>
    </div>
  )
}
