import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Empty, Field, Note, Page, PrecoApp, Sheet, TopBar, cx } from '../components/ui'
import { ICalendar, IClock, IRepeat, IconeServico } from '../components/Icons'
import { NaoEncontrado } from './Barbearia'
import { barbeariaPermitida, horariosLivres, jornadaDe, profissionalAtivo, precoNoApp, resumoJornada, servicoCabe } from '../domain/rules'
import { brlFull, dataHoraLonga, diaLocal, hora, somarMinutos } from '../lib/format'
import type { Agendamento, Servico } from '../domain/types'

/** Contexto que acompanha a escolha: serviço já escolhido ou reserva sendo remarcada. */
function useFluxo() {
  const [params] = useSearchParams()
  const { db } = useApp()
  const u = useUsuario()
  const servicoId = params.get('servico')
  const remarcarId = params.get('remarcar')
  const servico = servicoId ? db.servicos.find((s) => s.id === servicoId && s.disponivel) : undefined
  const remarcar = remarcarId ? db.agendamentos.find((a) => a.id === remarcarId && a.clienteEmail === u.email && a.status === 'Confirmado') : undefined
  const sufixo = remarcar ? `?remarcar=${remarcar.id}` : servico ? `?servico=${servico.id}` : ''
  /** Duração que precisa caber no intervalo. */
  const duracao = remarcar ? (remarcar.duracaoReservada ?? 0) : (servico?.duracaoMinutos ?? 0)
  return { servico, remarcar, sufixo, duracao }
}

function BannerFluxo({ servico, remarcar }: { servico?: Servico; remarcar?: Agendamento }) {
  const { db } = useApp()
  if (remarcar)
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft p-3.5 text-[14.5px]">
        <IRepeat className="shrink-0 text-brand-ink" />
        <span>
          Remarcando {db.servicos.find((s) => s.id === remarcar.servicoId)?.nome ?? 'a reserva'} de {dataHoraLonga(remarcar.inicio)}.
        </span>
      </div>
    )
  if (servico)
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft">
          <IconeServico tipo={servico.icone} size={26} />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold">{servico.nome}</span>
          <span className="block text-[13.5px] text-muted">
            {servico.duracaoMinutos} min · <PrecoApp {...precoNoApp(db, servico)} formatar={brlFull} />
          </span>
        </span>
      </div>
    )
  return null
}

/** Profissional: escolher data, ver horários e selecionar um intervalo livre. */
export function Profissional() {
  const { id } = useParams()
  const { db, prepararHorarios, atualizarUsuario } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const fluxo = useFluxo()
  const hoje = diaLocal()
  const salvo = u.dataBusca?.[id ?? '']
  const [dia, setDia] = useState(salvo && salvo >= hoje ? salvo : hoje)
  const [carregando, setCarregando] = useState(true)
  const p = db.profissionais.find((x) => x.id === id)
  const jornada = jornadaDe(p)

  const livres = useMemo(
    () => (p ? horariosLivres(db, p.id, dia).filter((h) => !fluxo.duracao || (new Date(h.fim).getTime() - new Date(h.inicio).getTime()) / 60000 >= fluxo.duracao) : []),
    [db, p, dia, fluxo.duracao],
  )
  const proximosDias = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 14; i++) {
      out.push(diaLocal(d))
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [])

  // Prepara automaticamente ao abrir/trocar de dia (no Glide exigia tocar Buscar horários).
  useEffect(() => {
    if (!p) return
    let vivo = true
    setCarregando(true)
    prepararHorarios(p.id, dia).finally(() => vivo && setCarregando(false))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, dia, p?.jornada])

  if (!p || !profissionalAtivo(p) || !barbeariaPermitida(u, p.barbeariaId)) return <NaoEncontrado />

  const escolherDia = (d: string) => {
    setDia(d)
    atualizarUsuario({ dataBusca: { ...(u.dataBusca ?? {}), [p.id]: d } })
  }
  const atende = (d: string) => jornada.dias.includes(new Date(d + 'T12:00:00').getDay())

  return (
    <>
      <TopBar title={p.nome} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">{p.nome}</h1>
        <p className="mt-1 text-[16px] text-muted">{p.especialidades}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-faint">
          <IClock size={15} /> {resumoJornada(jornada)}
        </p>
        <BannerFluxo servico={fluxo.servico} remarcar={fluxo.remarcar} />

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
            const fechado = !atende(d)
            return (
              <button
                key={d}
                onClick={() => escolherDia(d)}
                aria-label={fechado ? `${dt.toLocaleDateString('pt-BR')} (não atende)` : undefined}
                className={cx(
                  'press flex w-[58px] shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition-colors duration-150',
                  ativo ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:border-faint',
                  fechado && !ativo && 'opacity-40',
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
          <div className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4">
            {livres.map((h) => (
              <button
                key={h.id}
                onClick={() => nav(`/agendar/${h.id}${fluxo.sufixo}`)}
                className="press h-12 rounded-xl border border-line bg-surface text-[16px] font-semibold tabular-nums text-brand-ink hover:border-brand"
                aria-label={dataHoraLonga(h.inicio)}
              >
                {hora(h.inicio)}
              </button>
            ))}
          </div>
        ) : carregando ? (
          <div className="grid grid-cols-3 gap-2 pt-2" aria-busy="true" aria-label="Carregando horários">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-12 animate-pulse rounded-xl bg-surface2" />
            ))}
          </div>
        ) : (
          <Empty
            icon={<IClock />}
            title={atende(dia) ? 'Sem horários livres' : 'Não atende neste dia'}
            text={atende(dia) ? 'Os horários deste dia já passaram, estão ocupados ou bloqueados. Tente outra data.' : `${p.nome.split(' ')[0]} atende ${resumoJornada(jornada)}.`}
          />
        )}
      </Page>
    </>
  )
}

/** Agendar atendimento (ou confirmar a remarcação): resumo do horário + revisão. */
export function Agendar() {
  const { horarioId } = useParams()
  const { db, confirmar, remarcar } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const fluxo = useFluxo()
  const [aberto, setAberto] = useState(false)
  const [servicoId, setServicoId] = useState<string | null>(fluxo.servico?.id ?? null)
  const [enviando, setEnviando] = useState(false)
  const h = db.horarios.find((x) => x.id === horarioId)
  if (!h || !barbeariaPermitida(u, h.barbeariaId)) return <NaoEncontrado />
  const b = db.barbearias.find((x) => x.id === h.barbeariaId)
  const p = db.profissionais.find((x) => x.id === h.profissionalId)
  const servicos = db.servicos.filter((s) => s.barbeariaId === h.barbeariaId && s.disponivel && servicoCabe(s, h))
  const sel = servicos.find((s) => s.id === servicoId)
  const indisponivel = h.status !== 'Livre' || new Date(h.inicio).getTime() <= Date.now()
  const r = fluxo.remarcar

  async function onConfirmar() {
    if (!sel) return
    setEnviando(true)
    const ag = await confirmar(h!.id, sel.id)
    setEnviando(false)
    if (ag) nav(`/agendamento/${ag.id}?novo=1`, { replace: true })
    else setAberto(false)
  }
  async function onRemarcar() {
    if (!r) return
    setEnviando(true)
    const ag = await remarcar(r.id, h!.id)
    setEnviando(false)
    if (ag) nav(`/agendamento/${ag.id}?novo=remarcado`, { replace: true })
  }

  if (r) {
    const sr = db.servicos.find((s) => s.id === r.servicoId)
    return (
      <>
        <TopBar title="Remarcar" />
        <Page className="pt-3">
          <h1 className="text-[28px] font-bold tracking-tight">Remarcar reserva</h1>
          <p className="mt-1 text-[16px] text-muted">Confira a troca. O horário antigo fica livre para outras pessoas.</p>
          <div className="mt-6">
            <Field label="Serviço">{sr?.nome}</Field>
            <Field label="Antes">
              <span className="text-muted line-through">{dataHoraLonga(r.inicio)}</span>
            </Field>
            <Field label="Novo horário">{dataHoraLonga(h.inicio)}</Field>
            <Field label="Profissional">{p?.nome}</Field>
            <Field label="Barbearia">{b?.nome}</Field>
          </div>
          {indisponivel ? (
            <div className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-red-200">Este horário não está mais disponível. Volte e escolha outro.</div>
          ) : (
            <Button className="mt-6" icon={<IRepeat size={20} />} disabled={enviando} onClick={onRemarcar}>
              {enviando ? 'Remarcando…' : 'Confirmar remarcação'}
            </Button>
          )}
        </Page>
      </>
    )
  }

  return (
    <>
      <TopBar title="Agendar atendimento" />
      <Page className="pt-3">
        <div className="text-[13px] font-semibold uppercase tracking-wide text-brand-ink">Horário selecionado</div>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">Agendar atendimento</h1>
        <p className="mt-1 text-[16px] text-muted">{sel ? 'Confira os dados e confirme.' : 'Escolha o serviço para conferir o valor e a duração do atendimento.'}</p>
        <h2 className="mt-7 text-[20px] font-bold">Seu horário escolhido</h2>
        <div className="mt-2">
          <Field label="Barbearia">{b?.nome}</Field>
          <Field label="Profissional">{p?.nome}</Field>
          <Field label="Data e hora">{dataHoraLonga(h.inicio)}</Field>
          {sel && <Field label="Serviço">{sel.nome}</Field>}
        </div>
        {indisponivel ? (
          <div className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-[15px] text-red-200">
            Este horário não está mais disponível.{' '}
            <Link to={p ? `/profissional/${p.id}${fluxo.sufixo}` : '/'} replace className="font-semibold underline">
              Escolher outro
            </Link>
          </div>
        ) : (
          <Button className="mt-6" onClick={() => setAberto(true)}>
            {sel ? 'Revisar e confirmar' : 'Escolher serviço'}
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
                <span className="text-[15.5px] font-semibold tabular-nums"><PrecoApp {...precoNoApp(db, s)} formatar={brlFull} /></span>
              </button>
            )
          })}
          {!servicos.length && <Note>Nenhum serviço disponível cabe neste horário.</Note>}
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
              <div className="text-right text-[22px] font-bold tabular-nums"><PrecoApp {...precoNoApp(db, sel)} formatar={brlFull} /></div>
            </div>
          ) : (
            <div className="mt-2 text-[15px]">Escolha um serviço acima.</div>
          )}
          <p className="mt-3 text-[14px] text-muted">Pagamento no estabelecimento. Dá para cancelar ou remarcar até 2h antes.</p>
        </div>

        <Button className="mt-5" disabled={!sel || enviando} onClick={onConfirmar}>
          {enviando ? 'Confirmando…' : 'Confirmar agendamento'}
        </Button>
      </Sheet>
    </>
  )
}
