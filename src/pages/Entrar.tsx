import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Button } from '../components/ui'
import { Carregando } from '../components/Shell'
import { IScissors, IUser } from '../components/Icons'
import { DEMO_BARBEIRO_EMAIL, DEMO_CLIENTE_EMAIL } from '../data/seed'

export default function Entrar() {
  const { entrar, verificarCodigo, usuario, pronto, modo } = useApp()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const destino = loc.state?.from ?? '/'
  const [email, setEmail] = useState('')
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Entrou (inclusive pelo link do e-mail): segue para o app.
  useEffect(() => {
    if (usuario) nav(destino, { replace: true })
  }, [usuario, destino, nav])

  if (!pronto) return <Carregando />

  async function enviar(e?: string) {
    setEnviando(true)
    const r = await entrar(e ?? email)
    setEnviando(false)
    if (r === 'codigo_enviado') setEtapa('codigo')
  }

  async function confirmarCodigo() {
    setEnviando(true)
    await verificarCodigo(email, codigo)
    setEnviando(false)
  }

  const campo =
    'mt-2 h-12 w-full rounded-xl border border-line bg-surface2 px-3.5 text-[16px] placeholder:text-faint focus:border-brand focus:outline-none'

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

        {etapa === 'email' ? (
          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
          >
            <label htmlFor="email" className="text-[15px] font-semibold">
              E-mail
            </label>
            <input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" className={campo} />
            <Button className="mt-4" disabled={!email.includes('@') || enviando}>
              {enviando ? 'Enviando…' : modo === 'supabase' ? 'Receber link de acesso' : 'Entrar'}
            </Button>
            {modo === 'supabase' && <p className="mt-3 text-[13.5px] leading-5 text-faint">Sem senha: enviamos um link e um código para o seu e-mail.</p>}
          </form>
        ) : (
          <form
            className="mt-8 animate-fade-up"
            onSubmit={(e) => {
              e.preventDefault()
              confirmarCodigo()
            }}
          >
            <p className="text-[15.5px] leading-6">
              Enviamos um link para <b>{email}</b>. Abra o e-mail neste aparelho e toque no link, ou digite o código abaixo.
            </p>
            <label htmlFor="codigo" className="mt-5 block text-[15px] font-semibold">
              Código
            </label>
            <input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className={campo + ' tracking-[0.3em] tabular-nums'}
            />
            <Button className="mt-4" disabled={codigo.length < 6 || enviando}>
              {enviando ? 'Verificando…' : 'Entrar'}
            </Button>
            <div className="mt-4 flex justify-between text-[14px]">
              <button type="button" className="text-muted" onClick={() => setEtapa('email')}>
                Trocar e-mail
              </button>
              <button type="button" className="font-semibold text-brand-ink" disabled={enviando} onClick={() => enviar()}>
                Reenviar
              </button>
            </div>
          </form>
        )}

        {modo === 'local' && (
          <>
            <div className="my-8 flex items-center gap-3 text-[13px] text-faint">
              <span className="h-px flex-1 bg-line" /> Contas de demonstração <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => enviar(DEMO_CLIENTE_EMAIL)} className="card-press rounded-2xl border border-line bg-surface p-4 text-left">
                <IUser className="text-brand-ink" />
                <div className="mt-3 text-[15.5px] font-semibold">Cliente</div>
                <div className="text-[13px] text-muted">Explorar e agendar</div>
              </button>
              <button onClick={() => enviar(DEMO_BARBEIRO_EMAIL)} className="card-press rounded-2xl border border-line bg-surface p-4 text-left">
                <IScissors className="text-brand-ink" />
                <div className="mt-3 text-[15.5px] font-semibold">Barbeiro</div>
                <div className="text-[13px] text-muted">Agenda e horários</div>
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
