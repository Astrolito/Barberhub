import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Empty, Field, Note, Page, Row, Sheet, TopBar, cx } from '../components/ui'
import { ICalendar, IClock, IconeServico } from '../components/Icons'
import { NaoEncontrado } from './Barbearia'
import { horariosLivres } from '../domain/rules'
import { brlFull, dataHoraLonga, diaLocal, hora, somarMinutos } from '../lib/format'

/** Profissional: escolher data, buscar horários e selecionar um intervalo livre. */
export function Profissional() {
  const { id } = useParams()
  const { db, prepararHorarios, atualizarUsuario } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const hoje = diaLocal()
  const salvo = u.dataBusca?.[id ?? '']
  const [dia, setDia] = useState(salvo && salvo >= hoje ? salvo : hoje)
  const [buscado, setBuscado] = useState(false)
  const p = db.profissionais.find((x) => x.id === id)

  const livres = useMemo(() => (p ? horariosLivres(db, p.id, dia) : []), [db, p, dia])
  const proximosDias = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 14; i++) {
      out.push(diaLocal(d))
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [])

  // Melhoria: prepara automaticamente ao abrir/trocar de dia (no Glide exigia tocar Buscar horários).
  useEffect(() => {
    if (!p) return
    prepararHorarios(p.id, dia)
    setBuscado(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, dia])

  if (!p) return <NaoEncontrado />

  const escolherDia = (d: string) => {
    setDia(d)
    atualizarUsuario({ dataBusca: { ...(u.dataBusca ?? {}), [p.id]: d } })
  }

  return (
    <>
      <TopBar title={p.nome} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">{p.nome}</h1>
        <p className="mt-1 text-[16px] text-muted">{p.especialidades}</p>

        <div className="mt-5">
          <Note>Escolha uma data a partir de hoje e selecione um horário livre da lista.</Note>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Escolha a data</h2>
          <label className="press relative flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-[13.5px] font-medium text-brand-ink">
            <ICalendar size={16} /> Outra data
            <input
              type="date"
              min={hoje}
              value={dia}
              onChange={(e) => e.target.value && e.target.value >= hoje && escolherDia(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Escolher outra data"
            />
          </label>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {(proximosDias.includes(dia) ? proximosDias : [dia, ...proximosDias]).map((d) => {
            const dt = new Date(d + 'T12:00:00')
            const ativo = d === dia
            return (
              <button
                key={d}
                onClick={() => escolherDia(d)}
                className={cx(
                  'press flex w-[58px] shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition-colors duration-150',
                  ativo ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:border-faint',
                )}
              >
                <span className={cx('text-[11.5px] font-semibold uppercase', ativo ? 'text-white/80' : 'text-faint')}>
                  {d === hoje ? 'Hoje' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                </span>
                <span className="text-[20px] font-bold tabular-nums">{dt.getDate()}</span>
                <span className={cx('text-[11px]', ativo ? 'text-white/80' : 'text-faint')}>{dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
              </button>
            )
          })}
        </div>

        <h2 className="mb-1 mt-8 text-[22px] font-bold tracking-tight">Horários disponíveis</h2>
        {livres.length ? (
          <div>
            {livres.map((h) => (
              <Row
                key={h.id}
                onClick={() => nav(`/agendar/${h.id}`)}
                leading={
                  <span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-brand-soft text-[17px] font-bold tabular-nums text-brand-ink">{hora(h.inicio)}</span>
                }
                title={dataHoraLonga(h.inicio)}
                subtitle="Toque para revisar o agendamento"
              />
            ))}
          </div>
        ) : (
          buscado && <Empty icon={<IClock />} title="Sem horários livres" text="Todos os horários deste dia já passaram, estão ocupados ou bloqueados. Tente outra data." />
        )}
      </Page>
    </>
  )
}

/** Agendar atendimento: resumo do horário + revisão em bottom sheet. */
export function Agendar() {
  const { horarioId } = useParams()
  const { db, confirmar } = useApp()
  const nav = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [servicoId, setServicoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const h = db.horarios.find((x) => x.id === horarioId)
  if (!h) return <NaoEncontrado />
  const b = db.barbearias.find((x) => x.id === h.barbeariaId)
  const p = db.profissionais.find((x) => x.id === h.profissionalId)
  const servicos = db.servicos.filter((s) => s.barbeariaId === h.barbeariaId && s.disponivel)
  const sel = servicos.find((s) => s.id === servicoId)
  const indisponivel = h.status !== 'Livre' || new Date(h.inicio).getTime() <= Date.now()

  async function onConfirmar() {
    if (!sel) return
    setEnviando(true)
    const ag = await confirmar(h!.id, sel.id)
    setEnviando(false)
    if (ag?.status === 'Confirmado') nav(`/agendamento/${ag.id}?novo=1`, { replace: true })
    else setAberto(false)
  }

  return (
    <>
      <TopBar title="Agendar atendimento" />
      <Page className="pt-3">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-brand-ink">Horário selecionado</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Agendar atendimento</h1>
        <p className="mt-1 text-[16px] text-muted">Escolha o serviço para conferir o valor e a duração do atendimento.</p>
        <h2 className="mt-7 text-[20px] font-bold">Seu horário escolhido</h2>
        <div className="mt-2">
          <Field label="Barbearia">{b?.nome}</Field>
          <Field label="Profissional">{p?.nome}</Field>
          <Field label="Data e hora">{dataHoraLonga(h.inicio)}</Field>
        </div>
        {indisponivel ? (
          <div className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-red-200">Este horário não está mais disponível. Volte e escolha outro.</div>
        ) : (
          <Button className="mt-6" onClick={() => setAberto(true)}>
            Escolher serviço
          </Button>
        )}
      </Page>

      <Sheet open={aberto} onClose={() => setAberto(false)} title="Revisar agendamento">
        <div className="flex items-center justify-between pt-2">
          <h3 className="text-[18px] font-semibold">Serviço</h3>
          <span className="text-[13.5px] text-faint">Necessário</span>
        </div>
        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Serviço">
          {servicos.map((s) => {
            const on = s.id === servicoId
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={on}
                onClick={() => setServicoId(s.id)}
                className={cx(
                  'press flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors duration-150',
                  on ? 'border-brand bg-brand/10' : 'border-line bg-surface2/60 hover:border-faint',
                )}
              >
                <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors', on ? 'border-brand' : 'border-faint')}>
                  <span className={cx('h-2.5 w-2.5 rounded-full bg-brand transition-transform duration-150 ease-out', on ? 'scale-100' : 'scale-0')} />
                </span>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft">
                  <IconeServico tipo={s.icone} size={26} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15.5px] font-semibold">{s.nome}</span>
                  <span className="block text-[13.5px] text-muted">{s.duracaoMinutos} min</span>
                </span>
                <span className="text-[15.5px] font-semibold tabular-nums">{brlFull(s.preco)}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 rounded-2xl bg-surface2/70 p-4">
          <div className="text-[15px] text-muted">{dataHoraLonga(h.inicio)}</div>
          {sel ? (
            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-[16px] font-semibold">{sel.nome}</div>
                <div className="text-[13.5px] text-muted">
                  {hora(h.inicio)} – {hora(somarMinutos(h.inicio, sel.duracaoMinutos))} · {sel.duracaoMinutos} min
                </div>
              </div>
              <div className="text-[22px] font-bold tabular-nums">{brlFull(sel.preco)}</div>
            </div>
          ) : (
            <div className="mt-2 text-[15px]">Escolha um serviço acima.</div>
          )}
          <p className="mt-3 text-[14px] text-muted">Confira o serviço, o valor e o horário antes de confirmar. Pagamento no estabelecimento.</p>
        </div>

        <Button className="mt-5" disabled={!sel || enviando} onClick={onConfirmar}>
          {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
        </Button>
      </Sheet>
    </>
  )
}
