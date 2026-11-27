import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp, useUsuario } from '../../state/AppContext'
import { Button, Campo, Capa, Empty, Note, Page, Row, Sheet, StatusLabel, Switch, TopBar, cx, inputCls } from '../../components/ui'
import { ICalendar, ICamera, IChevron, IClock, IList, ILock, IPlus, IScissors, IStore, ITag, IUnlock, IUsers, IconeServico } from '../../components/Icons'
import { lerImagem } from '../../lib/image'
import { brlFull, dataHoraLonga, diaLocal, hora } from '../../lib/format'
import { INTERVALOS_PERMITIDOS, aguardandoBarbeiro, assinaturaDe, ehDono, equipeAtiva, podeGerir, parceriaVigente, situacaoAssinatura, iniciosDoDia, jornadaDe, resumoBarbeiro, resumoJornada, validarJornada, type ServicoEditavel } from '../../domain/rules'
import type { IconeServico as TIcone, Jornada, Servico } from '../../domain/types'

export function useGuard() {
  const u = useUsuario()
  return u.papel === 'Barbeiro' && u.profissionalId ? u : null
}

/** Só o dono da unidade: equipe, serviços, dados da unidade, plano e parceria. */
export function useDono() {
  const u = useGuard()
  return ehDono(u) ? u : null
}

/** Profissional cuja agenda a tela mostra: o próprio, ou (dono) quem veio em ?prof=. */
function useAlvo() {
  const u = useGuard()
  const { db } = useApp()
  const [params] = useSearchParams()
  const pedido = params.get('prof')
  if (!u) return null
  const id = pedido ?? u.profissionalId!
  if (!podeGerir(db, u, id)) return null
  const prof = db.profissionais.find((p) => p.id === id)
  return { u, id, prof, outro: id !== u.profissionalId }
}

export function SemAcesso({ dono }: { dono?: boolean }) {
  return (
    <>
      <TopBar title="Área do barbeiro" />
      <Page>
        <Empty
          icon={<IScissors />}
          title="Acesso restrito"
          text={dono ? 'Só o dono da barbearia pode gerenciar isto. Fale com ele se precisar de uma mudança.' : 'Esta área é exclusiva para barbeiros com vínculo a uma barbearia.'}
        />
      </Page>
    </>
  )
}

function Numero({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={cx('rounded-2xl border p-3.5', destaque ? 'border-amber-400/40 bg-amber-400/10' : 'border-line bg-surface')}>
      <div className="text-[12.5px] font-semibold uppercase tracking-wide text-faint">{rotulo}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums leading-tight">{valor}</div>
      {detalhe && <div className="text-[13px] text-muted">{detalhe}</div>}
    </div>
  )
}

export default function AreaBarbeiro() {
  const u = useGuard()
  const { db } = useApp()
  if (!u) return <SemAcesso />
  const r = resumoBarbeiro(db, u.profissionalId!)
  const prof = db.profissionais.find((p) => p.id === u.profissionalId)
  const dono = ehDono(u)
  const unidade = db.barbearias.find((b) => b.id === u.barbeariaId)
  const equipe = equipeAtiva(db, u.barbeariaId)
  const assinatura = assinaturaDe(db, u.barbeariaId)
  const situacao = situacaoAssinatura(assinatura)
  const parceria = u.barbeariaId ? parceriaVigente(db, u.barbeariaId) : undefined
  const ate = assinatura ? new Date(assinatura.validaAte).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''
  const textoPlano =
    situacao === 'Teste'
      ? `Teste grátis até ${ate}`
      : situacao === 'Ativa'
        ? `Ativa até ${ate}${parceria ? ` · parceira −${parceria.descontoPct}%` : ''}`
        : situacao === 'Pendente'
          ? 'Aguardando pagamento'
          : situacao === 'Cancelada'
            ? `Cancelada, no ar até ${ate}`
            : situacao === 'Vencida'
              ? 'Vencida: renove para aparecer na busca'
              : 'Escolha um plano'
  const cards = [
    { to: '/barbeiro/atendimentos', icon: <ICalendar />, title: 'Atendimentos', text: r.pendentes ? `${r.pendentes} aguardando você` : dono ? 'Seus e da equipe' : 'Próximos e histórico' },
    { to: '/barbeiro/horarios', icon: <IClock />, title: 'Meus horários', text: 'Bloquear e liberar intervalos' },
    { to: '/barbeiro/agenda', icon: <ICalendar />, title: 'Minha agenda', text: resumoJornada(jornadaDe(prof)) },
    ...(dono
      ? [
          { to: '/barbeiro/equipe', icon: <IUsers />, title: 'Equipe', text: `${equipe.length} barbeiro${equipe.length === 1 ? '' : 's'} · agendas e convites` },
          { to: '/barbeiro/servicos', icon: <IList />, title: 'Serviços', text: 'Preços, duração e disponibilidade' },
          { to: '/barbeiro/barbearia', icon: <IStore />, title: 'Minha barbearia', text: 'Foto, descrição e contato' },
          { to: '/barbeiro/plano', icon: <ITag />, title: 'Plano e parceria', text: textoPlano },
        ]
      : []),
  ]
  return (
    <>
      <TopBar title={dono ? 'Área do dono' : 'Área do barbeiro'} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">{dono ? 'Área do dono' : 'Área do barbeiro'}</h1>
        <p className="mt-1 text-[15.5px] text-muted">
          {prof?.nome} · {dono ? 'Dono' : 'Barbeiro'} da {unidade?.nome ?? 'barbearia'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Numero rotulo="Hoje" valor={String(r.hoje)} detalhe={`previsto ${brlFull(r.previstoHoje)}`} />
          <Numero rotulo="Esta semana" valor={String(r.semana)} detalhe={`previsto ${brlFull(r.previstoSemana)}`} />
          <Numero rotulo="Faturado no mês" valor={brlFull(r.faturadoMes)} detalhe={`${r.atendidosMes} atendido${r.atendidosMes === 1 ? '' : 's'}${r.faltasMes ? ` · ${r.faltasMes} falta${r.faltasMes > 1 ? 's' : ''}` : ''}`} />
          <Numero rotulo="Sua nota" valor={r.nota ? r.nota.toFixed(1).replace('.', ',') : '—'} detalhe={r.totalNotas ? `${r.totalNotas} avaliaç${r.totalNotas > 1 ? 'ões' : 'ão'}` : 'Sem avaliações ainda'} />
        </div>
        {r.pendentes > 0 && (
          <Link to="/barbeiro/atendimentos?aba=pendentes" className="press mt-2.5 flex items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-[15px] font-medium text-amber-200">
            {r.pendentes} atendimento{r.pendentes > 1 ? 's' : ''} para finalizar ou marcar falta
            <IChevron size={18} />
          </Link>
        )}
        {dono && (situacao === 'Vencida' || situacao === 'Sem assinatura') && (
          <Link to="/barbeiro/plano" className="press mt-2.5 flex items-center justify-between rounded-2xl border border-red-400/40 bg-red-500/10 p-3.5 text-[15px] font-medium text-red-200">
            Assinatura vencida: sua barbearia saiu da busca. Renovar
            <IChevron size={18} />
          </Link>
        )}
        <p className="mt-2 text-[12.5px] text-faint">Seus números, pelos preços reservados. Pagamento no estabelecimento.</p>
        {!dono && <p className="mt-1 text-[12.5px] text-faint">Serviços, dados da unidade e plano são geridos pelo dono da barbearia.</p>}

        <div className="mt-6 space-y-3">
          {cards.map((c, i) => (
            <Link key={c.to} to={c.to} className="card-press animate-fade-up flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">{c.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16.5px] font-semibold">{c.title}</span>
                <span className="block truncate text-[14px] text-muted">{c.text}</span>
              </span>
              <IChevron size={18} className="text-faint" />
            </Link>
          ))}
        </div>
      </Page>
    </>
  )
}

const fone = (d?: string) => (!d ? '' : d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`)

export function MinhaBarbearia() {
  const u = useDono()
  const { db, atualizarFotoBarbearia, atualizarBarbearia, toast } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const b = db.barbearias.find((x) => x.id === u?.barbeariaId)
  const [descricao, setDescricao] = useState(b?.descricao ?? '')
  const [whatsapp, setWhatsapp] = useState(fone(b?.whatsapp))
  const [telefone, setTelefone] = useState(fone(b?.telefone))
  const [enviando, setEnviando] = useState<'foto' | 'dados' | null>(null)
  if (!u || !b) return <SemAcesso dono />
  return (
    <>
      <TopBar title="Minha barbearia" />
      <Page className="pt-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line">
          <Capa b={b} big />
          {enviando === 'foto' && <div className="absolute inset-0 grid place-items-center bg-black/50 text-[15px] font-medium">Enviando…</div>}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="md" variant="soft" icon={<ICamera size={19} />} disabled={!!enviando} onClick={() => input.current?.click()}>
            {b.fotoCapa ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {b.fotoCapa && (
            <Button size="md" variant="ghost" className="!w-auto" disabled={!!enviando} onClick={() => atualizarFotoBarbearia(b.id, undefined)}>
              Remover
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setEnviando('foto')
            try {
              await atualizarFotoBarbearia(b.id, await lerImagem(f))
            } catch (err) {
              toast((err as Error).message, 'erro')
            }
            setEnviando(null)
          }}
        />
        <h1 className="mt-6 text-[24px] font-bold leading-tight">{b.nome}</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">{b.endereco}</p>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setEnviando('dados')
            await atualizarBarbearia({ descricao, whatsapp, telefone })
            setEnviando(null)
          }}
        >
          <Campo label="Descrição" dica="Aparece na página da unidade.">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value.slice(0, 400))} rows={3} className={cx(inputCls, 'h-auto resize-none py-3')} />
          </Campo>
          <Campo label="WhatsApp" dica="Com DDD. O cliente abre a conversa direto pelo app.">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="(92) 99999-9999" className={inputCls} />
          </Campo>
          <Campo label="Telefone">
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(92) 3333-3333" className={inputCls} />
          </Campo>
          <Button className="mt-6" disabled={!!enviando}>
            {enviando === 'dados' ? 'Salvando…' : 'Salvar dados da unidade'}
          </Button>
        </form>
        <div className="mt-5">
          <Note>A foto e o contato aparecem no catálogo e na página da unidade. O horário de atendimento vem da agenda de cada barbeiro.</Note>
        </div>
      </Page>
    </>
  )
}

export function Atendimentos() {
  const u = useGuard()
  const { db, encerrar } = useApp()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const inicial = params.get('aba')
  const [aba, setAba] = useState<'proximos' | 'pendentes' | 'historico'>(inicial === 'pendentes' ? 'pendentes' : 'proximos')
  const [enviando, setEnviando] = useState<string | null>(null)
  const dono = ehDono(u)
  // Dono escolhe de quem ver: os próprios, de um barbeiro ou de toda a equipe.
  const [de, setDe] = useState<string>(params.get('prof') ?? u?.profissionalId ?? '')
  const equipe = dono ? equipeAtiva(db, u!.barbeariaId) : []
  const meus = useMemo(
    () => (u ? db.agendamentos.filter((a) => (dono && de === 'todos' ? a.barbeariaId === u.barbeariaId : a.profissionalId === (dono ? de : u.profissionalId))) : []),
    [db, u, dono, de],
  )
  const pendentes = meus.filter(aguardandoBarbeiro)
  const lista = useMemo(() => {
    if (aba === 'pendentes') return [...pendentes].sort((a, b) => a.inicio.localeCompare(b.inicio))
    if (aba === 'proximos') return meus.filter((a) => a.status === 'Confirmado' && !aguardandoBarbeiro(a)).sort((a, b) => a.inicio.localeCompare(b.inicio))
    return meus.filter((a) => a.status === 'Finalizado' || a.status === 'Cancelado' || a.status === 'Não compareceu').sort((a, b) => b.inicio.localeCompare(a.inicio))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meus, aba])
  if (!u) return <SemAcesso />
  const nomeServ = (id: string) => db.servicos.find((s) => s.id === id)?.nome
  const nomeProf = (id: string) => db.profissionais.find((p) => p.id === id)?.nome
  const encerrarUm = async (id: string, r: 'Finalizado' | 'Não compareceu') => {
    setEnviando(id)
    await encerrar(id, r)
    setEnviando(null)
  }
  return (
    <>
      <TopBar title="Atendimentos" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Atendimentos</h1>
        {dono && (
          <select value={de} onChange={(e) => setDe(e.target.value)} className={cx(inputCls, 'mt-4 appearance-none')} aria-label="Barbeiro">
            {equipe.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === u.profissionalId ? `Meus (${p.nome})` : p.nome}
              </option>
            ))}
            <option value="todos">Toda a equipe</option>
          </select>
        )}
        <Segmented
          value={aba}
          onChange={setAba}
          options={[
            ['proximos', 'Próximos'],
            ['pendentes', pendentes.length ? `Pendentes (${pendentes.length})` : 'Pendentes'],
            ['historico', 'Histórico'],
          ]}
        />
        {aba === 'pendentes' && lista.length > 0 && <p className="mt-3 text-[14px] text-muted">Horários que já começaram. Finalize ou registre a falta.</p>}
        {lista.length ? (
          <div className="mt-2">
            {lista.map((a) => (
              <div key={a.id} className="border-b border-line/70 py-3.5 last:border-0">
                <button onClick={() => nav(`/agendamento/${a.id}`)} className="row-press block w-full text-left">
                  <div className="text-[12.5px] font-semibold">
                    <StatusLabel s={a.status} aguardando={aguardandoBarbeiro(a)} />
                  </div>
                  <div className="text-[16px] font-semibold">
                    {a.clienteNome ?? 'Cliente'} · {nomeServ(a.servicoId)}
                  </div>
                  {dono && de === 'todos' && <div className="text-[13.5px] text-faint">com {nomeProf(a.profissionalId)}</div>}
                  <div className="text-[14.5px] text-muted">{dataHoraLonga(a.inicio)}</div>
                </button>
                {aguardandoBarbeiro(a) && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" disabled={enviando === a.id} onClick={() => encerrarUm(a.id, 'Finalizado')}>
                      Finalizar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={enviando === a.id} onClick={() => encerrarUm(a.id, 'Não compareceu')}>
                      Não compareceu
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={<ICalendar />}
            title={aba === 'proximos' ? 'Nenhum atendimento marcado' : aba === 'pendentes' ? 'Tudo em dia' : 'Sem histórico'}
            text={aba === 'pendentes' ? 'Nenhum atendimento esperando finalização.' : dono && de !== u.profissionalId ? 'As reservas deste filtro aparecem aqui.' : 'As reservas atribuídas a você aparecem aqui.'}
          />
        )}
      </Page>
    </>
  )
}

export function MeusHorarios() {
  const alvo = useAlvo()
  const { db, alternarBloqueio, prepararHorarios } = useApp()
  const [dia, setDia] = useState(diaLocal())
  const prof = alvo?.prof
  useEffect(() => {
    if (alvo?.id) prepararHorarios(alvo.id, dia)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.id, dia, prof?.jornada])
  if (!alvo) return <SemAcesso dono />
  const titulo = alvo.outro ? `Horários de ${prof?.nome.split(' ')[0]}` : 'Meus horários'
  const lista = db.horarios
    .filter((h) => h.profissionalId === alvo.id && diaLocal(new Date(h.inicio)) === dia)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  return (
    <>
      <TopBar title={titulo} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {resumoJornada(jornadaDe(prof))}.{' '}
          <Link to={alvo.outro ? `/barbeiro/agenda?prof=${alvo.id}` : '/barbeiro/agenda'} className="font-semibold text-brand-ink">
            Alterar agenda
          </Link>
        </p>
        <input
          type="date"
          min={diaLocal()}
          value={dia}
          onChange={(e) => e.target.value && setDia(e.target.value)}
          className={cx(inputCls, 'mt-5')}
          aria-label="Dia"
        />
        {lista.length ? (
          <div className="mt-3">
            {lista.map((h) => {
              const ocupado = h.status === 'Ocupado'
              const passado = new Date(h.inicio).getTime() <= Date.now()
              return (
                <Row
                  key={h.id}
                  leading={<span className="grid h-12 w-16 shrink-0 place-items-center rounded-xl bg-surface2 text-[17px] font-bold tabular-nums">{hora(h.inicio)}</span>}
                  title={`até ${hora(h.fim)}`}
                  subtitle={
                    <span className={cx(h.status === 'Livre' && 'text-ok', h.status === 'Bloqueado' && 'text-danger', ocupado && 'text-brand-ink')}>
                      {h.status}
                      {passado && ' · encerrado'}
                    </span>
                  }
                  trailing={
                    !ocupado && !passado ? (
                      <Button size="sm" variant={h.status === 'Livre' ? 'ghost' : 'soft'} icon={h.status === 'Livre' ? <ILock size={16} /> : <IUnlock size={16} />} onClick={() => alternarBloqueio(h.id)}>
                        {h.status === 'Livre' ? 'Bloquear' : 'Liberar'}
                      </Button>
                    ) : (
                      <span />
                    )
                  }
                />
              )
            })}
          </div>
        ) : (
          <Empty icon={<IClock />} title="Nenhum intervalo neste dia" text={alvo.outro ? 'Não há atendimento neste dia ou os horários já passaram. Ajuste a agenda.' : 'Você não atende neste dia ou os horários já passaram. Ajuste em Minha agenda.'} />
        )}
      </Page>
    </>
  )
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Agenda configurável: dias, expediente e duração de cada intervalo. */
export function MinhaAgenda() {
  const alvo = useAlvo()
  const { salvarJornada } = useApp()
  const nav = useNavigate()
  const prof = alvo?.prof
  const [j, setJ] = useState<Jornada>(jornadaDe(prof))
  const [enviando, setEnviando] = useState(false)
  const erro = useMemo(() => {
    try {
      validarJornada(j)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [j])
  // Prévia de um dia atendido (segunda-feira de referência).
  const previa = useMemo(() => (erro ? [] : iniciosDoDia({ ...j, dias: [1] }, '2026-11-23')), [j, erro])
  if (!alvo) return <SemAcesso dono />
  const titulo = alvo.outro ? `Agenda de ${prof?.nome.split(' ')[0]}` : 'Minha agenda'
  return (
    <>
      <TopBar title={titulo} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-[15px] text-muted">
          {alvo.outro ? `Defina quando ${prof?.nome} atende.` : 'Defina quando você atende.'} Os clientes só veem horários dentro desta agenda.
        </p>

        <h2 className="mt-6 text-[15px] font-semibold">Dias de atendimento</h2>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {DIAS.map((nome, d) => {
            const on = j.dias.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setJ({ ...j, dias: on ? j.dias.filter((x) => x !== d) : [...j.dias, d].sort() })}
                className={cx('press h-11 rounded-xl border text-[13.5px] font-semibold', on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted')}
              >
                {nome}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Começa às">
            <input type="time" step={900} value={j.inicio} onChange={(e) => e.target.value && setJ({ ...j, inicio: e.target.value })} className={inputCls} />
          </Campo>
          <Campo label="Último termina até">
            <input type="time" step={900} value={j.fim} onChange={(e) => e.target.value && setJ({ ...j, fim: e.target.value })} className={inputCls} />
          </Campo>
        </div>
        <Campo label="Duração de cada horário" dica="Serviços mais longos que isso não aparecem para reserva.">
          <select value={j.intervaloMin} onChange={(e) => setJ({ ...j, intervaloMin: Number(e.target.value) })} className={cx(inputCls, 'appearance-none')}>
            {INTERVALOS_PERMITIDOS.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`}
              </option>
            ))}
          </select>
        </Campo>

        <h2 className="mt-6 text-[15px] font-semibold">Horários de cada dia</h2>
        {erro ? (
          <p className="mt-2 text-[14.5px] text-danger">{erro}</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {previa.map((h) => (
              <span key={h} className="rounded-lg bg-surface2 px-2.5 py-1.5 text-[14px] font-semibold tabular-nums text-brand-ink">
                {h}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-[13.5px] text-faint">Reservas já confirmadas e horários bloqueados não mudam.</p>

        <Button
          className="mt-6"
          disabled={!!erro || enviando}
          onClick={async () => {
            setEnviando(true)
            const ok = await salvarJornada(j, alvo.outro ? alvo.id : undefined)
            setEnviando(false)
            if (ok) nav(alvo.outro ? `/barbeiro/horarios?prof=${alvo.id}` : '/barbeiro/horarios')
          }}
        >
          {enviando ? 'Salvando…' : 'Salvar agenda'}
        </Button>
      </Page>
    </>
  )
}

const ICONES: [TIcone, string][] = [
  ['corte', 'Corte'],
  ['barba', 'Barba'],
  ['combo', 'Combo'],
  ['pezinho', 'Acabamento'],
]
const novoServico = (): ServicoEditavel => ({ nome: '', descricao: '', preco: 0, duracaoMinutos: 30, categoria: '', inclui: '', disponivel: true, icone: 'corte' })

/** Serviços da unidade: o barbeiro cria, edita e pausa. */
export function Servicos() {
  const u = useDono()
  const { db, salvarServico } = useApp()
  const [editando, setEditando] = useState<ServicoEditavel | null>(null)
  const [enviando, setEnviando] = useState(false)
  if (!u) return <SemAcesso dono />
  const lista = db.servicos.filter((s) => s.barbeariaId === u.barbeariaId).sort((a, b) => Number(b.disponivel) - Number(a.disponivel) || a.nome.localeCompare(b.nome))
  const prof = db.profissionais.find((p) => p.id === u.profissionalId)
  const intervalo = jornadaDe(prof).intervaloMin
  const editar = (s: Servico) => setEditando({ id: s.id, nome: s.nome, descricao: s.descricao, preco: s.preco, duracaoMinutos: s.duracaoMinutos, categoria: s.categoria, inclui: s.inclui, disponivel: s.disponivel, icone: s.icone })

  return (
    <>
      <TopBar title="Serviços" right={<Button size="sm" variant="soft" icon={<IPlus size={16} />} onClick={() => setEditando(novoServico())}>Novo</Button>} />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Serviços</h1>
        <p className="mt-1 text-[15px] text-muted">Valem para todos os barbeiros da unidade. Reservas feitas mantêm o preço da época.</p>
        <div className="mt-3">
          {lista.map((s) => (
            <Row
              key={s.id}
              onClick={() => editar(s)}
              leading={
                <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft', !s.disponivel && 'opacity-40')}>
                  <IconeServico tipo={s.icone} size={30} />
                </span>
              }
              overline={s.disponivel ? <span className="tabular-nums">{brlFull(s.preco)}</span> : <span className="text-faint">PAUSADO</span>}
              title={s.nome}
              subtitle={
                <>
                  {s.duracaoMinutos} min
                  {s.duracaoMinutos > intervalo && <span className="block text-[13px] text-amber-400">Maior que seu intervalo de {intervalo} min: não aparece na sua agenda</span>}
                </>
              }
            />
          ))}
        </div>
        {!lista.length && <Empty icon={<IList />} title="Nenhum serviço" text="Crie o primeiro serviço para abrir a agenda aos clientes." />}
      </Page>

      <Sheet open={!!editando} onClose={() => setEditando(null)} title={editando?.id ? 'Editar serviço' : 'Novo serviço'}>
        {editando && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setEnviando(true)
              const r = await salvarServico(editando)
              setEnviando(false)
              if (r) setEditando(null)
            }}
          >
            <Campo label="Nome">
              <input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} maxLength={60} className={inputCls} placeholder="Corte masculino" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Preço (R$)">
                <input
                  inputMode="decimal"
                  value={String(editando.preco).replace('.', ',')}
                  onChange={(e) => setEditando({ ...editando, preco: Number(e.target.value.replace(/[^\d,]/g, '').replace(',', '.')) || 0 })}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Duração (min)">
                <input
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  value={editando.duracaoMinutos}
                  onChange={(e) => setEditando({ ...editando, duracaoMinutos: Math.round(Number(e.target.value)) || 0 })}
                  className={inputCls}
                />
              </Campo>
            </div>
            <Campo label="Descrição">
              <input value={editando.descricao} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} maxLength={200} className={inputCls} />
            </Campo>
            <Campo label="Inclui">
              <input value={editando.inclui} onChange={(e) => setEditando({ ...editando, inclui: e.target.value })} maxLength={120} className={inputCls} placeholder="Shampoo, finalizador" />
            </Campo>
            <Campo label="Ícone">
              <div className="grid grid-cols-4 gap-2">
                {ICONES.map(([ic, nome]) => (
                  <button
                    key={ic}
                    type="button"
                    aria-pressed={editando.icone === ic}
                    onClick={() => setEditando({ ...editando, icone: ic, categoria: editando.categoria || nome })}
                    className={cx('press flex flex-col items-center gap-1 rounded-xl border py-2 text-[12px]', editando.icone === ic ? 'border-brand bg-brand/10' : 'border-line bg-surface2/60')}
                  >
                    <IconeServico tipo={ic} size={28} />
                    {nome}
                  </button>
                ))}
              </div>
            </Campo>
            <div className="mt-5 flex items-center justify-between rounded-xl bg-surface2/70 px-4 py-3">
              <span>
                <span className="block text-[15px] font-semibold">Disponível para reserva</span>
                <span className="block text-[13px] text-muted">Desligue para pausar sem apagar.</span>
              </span>
              <Switch checked={editando.disponivel} onChange={(v) => setEditando({ ...editando, disponivel: v })} label="Disponível" />
            </div>
            <Button className="mt-6" disabled={enviando}>
              {enviando ? 'Salvando…' : 'Salvar serviço'}
            </Button>
          </form>
        )}
      </Sheet>
    </>
  )
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  const idx = options.findIndex(([v]) => v === value)
  return (
    <div className="relative mt-5 grid h-11 rounded-xl bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      <span
        className="absolute inset-y-1 rounded-lg bg-line transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(calc(${idx * 100}%))`, left: 4 }}
      />
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cx('relative z-10 text-[14px] font-semibold transition-colors', v === value ? 'text-ink' : 'text-muted')}>
          {l}
        </button>
      ))}
    </div>
  )
}

