import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Barbearia, StatusAgendamento } from '../domain/types'
import { IBack, IChevron, ISearch, IX } from './Icons'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

// Botões com feedback de pressão (scale 0.97) e transições curtas com ease-out.
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'white' | 'soft' | 'danger' | 'ghost'
  size?: 'md' | 'lg' | 'sm'
  icon?: ReactNode
}
export function Button({ variant = 'primary', size = 'lg', icon, className, children, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'press inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,opacity,transform] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45',
        size === 'lg' && 'h-[52px] w-full px-5 text-[16px]',
        size === 'md' && 'h-11 w-full px-4 text-[15px]',
        size === 'sm' && 'h-9 shrink-0 rounded-full px-4 text-[14px]',
        variant === 'primary' && 'bg-brand text-white hover:bg-brand-hover',
        variant === 'white' && 'bg-white text-brand hover:bg-zinc-100',
        variant === 'soft' && 'bg-brand-soft text-brand-ink hover:bg-[#10305a]',
        variant === 'danger' && 'border border-danger/70 bg-danger-soft text-danger hover:bg-[#3a1418]',
        variant === 'ghost' && 'bg-surface2 text-ink hover:bg-line',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

export function TopBar({ title, back = true, right, transparent }: { title?: string; back?: boolean; right?: ReactNode; transparent?: boolean }) {
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header
      className={cx(
        'sticky top-0 z-30 flex h-14 items-center gap-2 px-2 pt-safe transition-colors duration-200',
        transparent && !scrolled ? 'bg-transparent' : 'border-b border-line/60 bg-bg/85 backdrop-blur-xl',
      )}
    >
      {back && (
        <button aria-label="Voltar" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="press grid h-10 w-10 place-items-center rounded-full text-brand-ink hover:bg-surface2">
          <IBack />
        </button>
      )}
      <h1 className={cx('flex-1 truncate text-[17px] font-semibold transition-opacity duration-200', transparent && !scrolled && 'opacity-0', !back && 'px-2')}>{title}</h1>
      {right}
    </header>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Procurar' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl bg-surface2 px-3 text-faint ring-brand/60 transition-shadow focus-within:ring-2">
      <ISearch size={19} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full flex-1 bg-transparent text-[16px] text-ink placeholder:text-faint focus:outline-none"
      />
      {value && (
        <button aria-label="Limpar busca" onClick={() => onChange('')} className="press grid h-6 w-6 place-items-center rounded-full bg-line text-muted">
          <IX size={14} />
        </button>
      )}
    </label>
  )
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx('relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ease-out disabled:opacity-50', checked ? 'bg-brand' : 'bg-line')}
    >
      <span className={cx('absolute left-0 top-[3px] h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out', checked ? 'translate-x-[25px]' : 'translate-x-[3px]')} />
    </button>
  )
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-xl2 bg-brand-soft/80 px-4 py-3.5 text-[15px] leading-6 text-zinc-200">{children}</div>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-end justify-between">
      <h2 className="text-[22px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function Row({ to, onClick, leading, overline, title, subtitle, trailing, danger }: {
  to?: string
  onClick?: () => void
  leading?: ReactNode
  overline?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  danger?: boolean
}) {
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        {overline && <div className="text-[12.5px] font-semibold uppercase tracking-wide text-brand-ink">{overline}</div>}
        <div className={cx('text-[16px] font-semibold leading-6', danger && 'text-danger')}>{title}</div>
        {subtitle && <div className="text-[14.5px] leading-5 text-muted">{subtitle}</div>}
      </div>
      {trailing ?? ((to || onClick) && <IChevron size={18} className="shrink-0 text-faint" />)}
    </>
  )
  const cls = 'flex items-center gap-3.5 border-b border-line/70 py-3.5 text-left last:border-0'
  if (to) return <Link to={to} className={cx(cls, 'row-press')}>{inner}</Link>
  if (onClick) return <button onClick={onClick} className={cx(cls, 'row-press w-full')}>{inner}</button>
  return <div className={cls}>{inner}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/70 py-3.5 last:border-0">
      <span className="shrink-0 text-[15px] text-muted">{label}</span>
      <span className="text-right text-[15px] font-medium">{children}</span>
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="animate-fade-up flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-surface2 text-brand-ink">{icon}</div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="mt-1 max-w-[280px] text-[14.5px] leading-5 text-muted">{text}</p>
      {action && <div className="mt-5 w-full max-w-[260px]">{action}</div>}
    </div>
  )
}

const COR_STATUS: Record<StatusAgendamento, string> = {
  Confirmado: 'text-brand-ink',
  Finalizado: 'text-ok',
  Cancelado: 'text-danger',
  Indisponível: 'text-faint',
}
export const StatusLabel = ({ s }: { s: StatusAgendamento }) => <span className={COR_STATUS[s]}>{s.toUpperCase()}</span>

/** Capa da barbearia: foto enviada ou identidade de espera. */
export function Capa({ b, className, big }: { b: Barbearia; className?: string; big?: boolean }) {
  if (b.fotoCapa) return <img src={b.fotoCapa} alt={b.nome} className={cx('h-full w-full object-cover', className)} />
  const f = b.marca.fonte === 'serif' ? 'font-serif' : b.marca.fonte === 'script' ? 'font-serif italic' : 'font-sans'
  return (
    <div className={cx('grid h-full w-full place-items-center', className)} style={{ background: b.marca.fundo }}>
      <div className="px-3 text-center" style={{ color: b.marca.cor }}>
        <div className={cx(f, 'font-black leading-none tracking-tight', big ? 'text-[44px]' : 'text-[26px]')}>{b.marca.sigla}</div>
        <div className={cx('mt-1.5 font-semibold uppercase tracking-[0.3em] opacity-80', big ? 'text-[12px]' : 'text-[8.5px]')}>Barbearia</div>
      </div>
    </div>
  )
}

/** Bottom sheet com entrada ease-drawer e fechamento por arrasto. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number; t: number } | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    setClosing(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const fechar = () => {
    setClosing(true)
    setTimeout(onClose, 220)
  }
  if (!open) return null

  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, dy: 0, t: Date.now() }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !ref.current) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    drag.current.dy = dy
    ref.current.style.transition = 'none'
    ref.current.style.transform = `translateY(${dy}px)`
  }
  const onUp = () => {
    if (!drag.current || !ref.current) return
    const { dy, t } = drag.current
    const vel = dy / Math.max(1, Date.now() - t)
    drag.current = null
    ref.current.style.transition = ''
    ref.current.style.transform = ''
    if (dy > 120 || vel > 0.6) fechar()
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={fechar} className={cx('absolute inset-0 bg-black/60 transition-opacity duration-200', closing ? 'opacity-0' : 'animate-fade-in')} />
      <div
        ref={ref}
        className={cx(
          'sheet absolute inset-x-0 bottom-0 mx-auto max-h-[92vh] max-w-[520px] overflow-hidden rounded-t-[22px] border-t border-line bg-surface pb-safe',
          closing ? 'translate-y-full' : 'animate-sheet-up',
        )}
      >
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className="cursor-grab touch-none pb-1 pt-2.5 active:cursor-grabbing">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <div className="relative mt-2 flex h-11 items-center justify-center px-14">
            <h2 className="truncate text-[18px] font-semibold">{title}</h2>
            <button aria-label="Fechar" onClick={fechar} className="press absolute right-4 grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted">
              <IX size={18} />
            </button>
          </div>
        </div>
        <div className="max-h-[calc(92vh-80px)] overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('animate-fade-up mx-auto w-full max-w-[520px] px-4 pb-28', className)}>{children}</main>
}
