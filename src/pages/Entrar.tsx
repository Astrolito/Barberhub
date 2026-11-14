import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Button } from '../components/ui'
import { IScissors, IUser } from '../components/Icons'
import { DEMO_BARBEIRO_EMAIL, DEMO_CLIENTE_EMAIL } from '../data/seed'

export default function Entrar() {
  const { entrar } = useApp()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const ir = (e: string) => entrar(e) && nav(loc.state?.from ?? '/', { replace: true })

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col justify-center px-6 py-10">
      <div className="animate-fade-up">
        <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-brand text-white shadow-[0_16px_40px_-12px_rgba(29,111,224,0.7)]">
          <IScissors size={30} />
        </div>
        <h1 className="mt-6 text-[32px] font-bold leading-tight tracking-tight">
          Bem-vindo ao Barber<span className="text-brand-ink">HUB</span>
        </h1>
        <p className="mt-2 text-[16px] leading-6 text-muted">Descubra barbearias em Manaus e reserve seu horário em poucos toques.</p>

        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault()
            ir(email)
          }}
        >
          <label htmlFor="email" className="text-[15px] font-semibold">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            className="mt-2 h-12 w-full rounded-xl border border-line bg-surface2 px-3.5 text-[16px] placeholder:text-faint focus:border-brand focus:outline-none"
          />
          <Button className="mt-4" disabled={!email.includes('@')}>
            Entrar
          </Button>
        </form>

        <div className="my-8 flex items-center gap-3 text-[13px] text-faint">
          <span className="h-px flex-1 bg-line" /> Contas de demonstração <span className="h-px flex-1 bg-line" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => ir(DEMO_CLIENTE_EMAIL)} className="card-press rounded-2xl border border-line bg-surface p-4 text-left">
            <IUser className="text-brand-ink" />
            <div className="mt-3 text-[15.5px] font-semibold">Cliente</div>
            <div className="text-[13px] text-muted">Explorar e agendar</div>
          </button>
          <button onClick={() => ir(DEMO_BARBEIRO_EMAIL)} className="card-press rounded-2xl border border-line bg-surface p-4 text-left">
            <IScissors className="text-brand-ink" />
            <div className="mt-3 text-[15.5px] font-semibold">Barbeiro</div>
            <div className="text-[13px] text-muted">Agenda e horários</div>
          </button>
        </div>
      </div>
    </main>
  )
}
