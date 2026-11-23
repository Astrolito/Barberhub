import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Empty, Estrelas, Field, Note, Page, Row, SearchInput, Sheet, StatusLabel, TopBar } from '../components/ui'
import { ICalendar, ICheck, IHistory, IRepeat, IX } from '../components/Icons'
import { NaoEncontrado, Contato } from './Barbearia'
import { ANTECEDENCIA_CANCELAR_MIN, aguardandoBarbeiro, noHistorico, podeAlterar, terminoServico } from '../domain/rules'
import { brlFull, dataHoraLonga, hora } from '../lib/format'
import { baixarIcs, linkGoogleAgenda } from '../lib/calendario'
import type { Agendamento } from '../domain/types'
import { Capacitor } from '@capacitor/core'

function useNomes() {
  const { db } = useApp()
  return {
    servico: (a: Agendamento) => db.servicos.find((s) => s.id === a.servicoId)?.nome ?? 'Serviço',
    barbearia: (a: Agendamento) => db.barbearias.find((s) => s.id === a.barbeariaId)?.nome ?? '',
    prof: (a: Agendamento) => db.profissionais.find((s) => s.id === a.profissionalId)?.nome ?? '',
  }
}

/** Agenda inferior: próximas reservas feitas OU recebidas pela conta (correção de 21/10). */
export default function Agendamentos() {
  const { db } = useApp()
  const u = useUsuario()
  const n = useNomes()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const lista = useMemo(
    () =>
      db.agendamentos
        .filter((a) => a.status === 'Confirmado' && (a.clienteEmail === u.email || (u.profissionalId && a.profissionalId === u.profissionalId)))
        // Reserva que já começou sai daqui: vai para o Histórico (cliente) ou Atendimentos > Pendentes (barbeiro).
        .filter((a) => !aguardandoBarbeiro(a))
        .filter((a) => `${n.servico(a)} ${n.barbearia(a)} ${n.prof(a)} ${a.clienteNome ?? ''} ${dataHoraLonga(a.inicio)}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, u, q],
  )
  return (
    <Page className="pt-4">
      <h1 className="text-[28px] font-bold tracking-tight">Agendamentos</h1>
      <div className="mt-4">
        <SearchInput value={q} onChange={setQ} />
      </div>
      {lista.length ? (
        <div className="mt-2">
          {lista.map((a) => (
            <Row
              key={a.id}
              to={`/agendamento/${a.id}`}
              overline={<StatusLabel s={a.status} />}
              title={n.servico(a)}
              subtitle={
                <>
                  {dataHoraLonga(a.inicio)}
                  <span className="block text-[13.5px] text-faint">
                    {a.clienteEmail === u.email ? n.barbearia(a) : `Atendimento de ${a.clienteNome ?? 'cliente'} · ${n.barbearia(a)}`}
                  </span>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={<ICalendar />}
          title={q ? 'Nada encontrado' : 'Nenhuma reserva futura'}
          text={q ? 'Tente outro termo de busca.' : 'Suas próximas reservas aparecem aqui. Escolha uma barbearia para agendar.'}
          action={!q && <Button size="md" onClick={() => nav('/')}>Explorar barbearias</Button>}
        />
      )}
    </Page>
  )
}

export function AgendamentoDetalhe() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { db, cancelar, encerrar } = useApp()
  const u = useUsuario()
  const n = useNomes()
  const nav = useNavigate()
  const [folha, setFolha] = useState<'cancelar' | 'falta' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const a = db.agendamentos.find((x) => x.id === id)
  if (!a || (a.clienteEmail !== u.email && a.profissionalId !== u.profissionalId)) return <NaoEncontrado />

  const ehTitular = a.clienteEmail === u.email
  const ehBarbeiro = u.papel === 'Barbeiro' && u.profissionalId === a.profissionalId
  const preco = a.precoReservado ?? db.servicos.find((s) => s.id === a.servicoId)?.preco
  const fimServico = terminoServico(db, a)
  const b = db.barbearias.find((x) => x.id === a.barbeariaId)
  const aguardando = aguardandoBarbeiro(a)
  const futura = a.status === 'Confirmado' && !aguardando
  const alteravel = podeAlterar(a)
  const avaliacao = db.avaliacoes.find((x) => x.agendamentoId === a.id)
  const evento = {
    id: a.id,
    titulo: `${n.servico(a)} · ${n.barbearia(a)}`,
    inicio: a.inicio,
    fim: fimServico,
    local: b?.endereco ?? '',
    detalhes: `Profissional: ${n.prof(a)}. Pagamento no estabelecimento. Protocolo ${a.protocolo}.`,
  }

  async function acao(fn: () => Promise<boolean>) {
    setEnviando(true)
    const ok = await fn()
    setEnviando(false)
    if (ok) setFolha(null)
  }

  return (
    <>
      <TopBar title="Agendamento" />
      <Page className="pt-3">
        {params.get('novo') && a.status === 'Confirmado' && (
          <div className="animate-fade-up mb-5 flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
              <ICheck size={22} />
            </span>
            <div>
              <div className="text-[16px] font-semibold">{params.get('novo') === 'remarcado' ? 'Reserva remarcada' : 'Reserva confirmada'}</div>
              <div className="text-[14px] text-zinc-300">Pagamento no estabelecimento. Chegue com 10 min de antecedência.</div>
            </div>
          </div>
        )}
        <h1 className="text-[28px] font-bold tracking-tight">Agendamento</h1>
        <p className="mt-1 text-[16px]">
          <StatusLabel s={a.status} aguardando={aguardando} />
        </p>

        {futura && ehTitular && (
          <>
            {/* No app instalado o lembrete chega como notificação; o .ics só funciona no navegador. */}
            <div className={Capacitor.isNativePlatform() ? 'mt-5' : 'mt-5 grid grid-cols-2 gap-2.5'}>
              <Button size="md" variant="soft" icon={<ICalendar size={19} />} onClick={() => window.open(linkGoogleAgenda(evento), '_blank', 'noopener')}>
                Google Agenda
              </Button>
              {!Capacitor.isNativePlatform() && (
                <Button size="md" variant="ghost" onClick={() => baixarIcs(evento)}>
                  Outro calendário
                </Button>
              )}
            </div>
            {alteravel ? (
              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <Button size="md" variant="ghost" icon={<IRepeat size={19} />} onClick={() => nav(`/barbearia/${a.barbeariaId}?remarcar=${a.id}`)}>
                  Remarcar
                </Button>
                <Button size="md" variant="danger" icon={<IX size={19} />} onClick={() => setFolha('cancelar')}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Note>
                  Cancelar ou remarcar só até {ANTECEDENCIA_CANCELAR_MIN / 60}h antes do horário. Se não puder ir, avise a barbearia.
                </Note>
                {b && <Contato b={b} />}
              </div>
            )}
          </>
        )}

        {a.status === 'Confirmado' && ehBarbeiro &&
          (aguardando ? (
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button size="md" icon={<ICheck size={19} />} disabled={enviando} onClick={() => acao(() => encerrar(a.id, 'Finalizado'))}>
                Finalizar
              </Button>
              <Button size="md" variant="ghost" disabled={enviando} onClick={() => setFolha('falta')}>
                Não compareceu
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-[14px] text-muted">Você pode finalizar ou marcar a falta a partir das {hora(a.inicio)}.</p>
          ))}

        {a.status === 'Finalizado' && ehTitular && <Avaliar agendamentoId={a.id} feita={avaliacao} />}

        <h2 className="mt-8 text-[20px] font-bold">Detalhes do agendamento</h2>
        <div className="mt-2">
          <Field label="Protocolo">
            <span className="break-all font-mono text-[13.5px]">{a.protocolo}</span>
          </Field>
          <Field label="Status">{aguardando ? 'Aguardando o barbeiro' : a.status}</Field>
          {!ehTitular && <Field label="Cliente">{a.clienteNome ?? 'Cliente'}</Field>}
          <Field label="Data e hora início">{dataHoraLonga(a.inicio)}</Field>
          <Field label="Término do serviço">{hora(fimServico)}</Field>
          <Field label="Fim do intervalo reservado">{dataHoraLonga(a.fim)}</Field>
          <Field label="Barbearia">{n.barbearia(a)}</Field>
          <Field label="Serviço">{n.servico(a)}</Field>
          <Field label="Profissional">{n.prof(a)}</Field>
          {preco !== undefined && <Field label="Valor">{brlFull(preco)}</Field>}
          <Field label="Pagamento">No estabelecimento</Field>
        </div>
      </Page>

      <Sheet open={folha === 'cancelar'} onClose={() => setFolha(null)} title="Cancelar reserva?">
        <p className="pt-2 text-[15.5px] leading-6 text-muted">
          {n.servico(a)} em {dataHoraLonga(a.inicio)} com {n.prof(a)}. O horário será liberado para outras pessoas e a reserva ficará no seu histórico.
        </p>
        <div className="mt-6 space-y-2.5">
          <Button variant="danger" disabled={enviando} onClick={() => acao(() => cancelar(a.id))}>
            {enviando ? 'Cancelando…' : 'Sim, cancelar reserva'}
          </Button>
          <Button variant="ghost" onClick={() => setFolha(null)}>
            Manter reserva
          </Button>
        </div>
      </Sheet>

      <Sheet open={folha === 'falta'} onClose={() => setFolha(null)} title="Cliente não compareceu?">
        <p className="pt-2 text-[15.5px] leading-6 text-muted">
          A reserva de {a.clienteNome ?? 'cliente'} às {hora(a.inicio)} fica registrada como falta. O horário continua ocupado.
        </p>
        <div className="mt-6 space-y-2.5">
          <Button variant="danger" disabled={enviando} onClick={() => acao(() => encerrar(a.id, 'Não compareceu'))}>
            Registrar falta
          </Button>
          <Button variant="ghost" onClick={() => setFolha(null)}>
            Voltar
          </Button>
        </div>
      </Sheet>
    </>
  )
}

function Avaliar({ agendamentoId, feita }: { agendamentoId: string; feita?: { nota: number; comentario: string } }) {
  const { avaliar } = useApp()
  const [nota, setNota] = useState(0)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  if (feita)
    return (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <div className="text-[14px] font-semibold text-muted">Sua avaliação</div>
        <div className="mt-1">
          <Estrelas valor={feita.nota} />
        </div>
        {feita.comentario && <p className="mt-2 text-[15px] leading-6">{feita.comentario}</p>}
      </div>
    )
  return (
    <div className="animate-fade-up mt-6 rounded-2xl border border-brand/30 bg-brand-soft/50 p-4">
      <div className="text-[16px] font-semibold">Como foi o atendimento?</div>
      <div className="mt-2">
        <Estrelas valor={nota} onChange={setNota} size={30} />
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, 500))}
        placeholder="Conte como foi (opcional)"
        rows={3}
        className="mt-3 w-full resize-none rounded-xl border border-line bg-surface2 px-3.5 py-3 text-[15.5px] placeholder:text-faint focus:border-brand focus:outline-none"
      />
      <Button
        size="md"
        className="mt-3"
        disabled={!nota || enviando}
        onClick={async () => {
          setEnviando(true)
          await avaliar(agendamentoId, nota, texto)
          setEnviando(false)
        }}
      >
        {enviando ? 'Enviando…' : 'Enviar avaliação'}
      </Button>
    </div>
  )
}

export function Historico() {
  const { db } = useApp()
  const u = useUsuario()
  const n = useNomes()
  const lista = db.agendamentos
    .filter((a) => a.clienteEmail === u.email && (noHistorico(a) || aguardandoBarbeiro(a)))
    .sort((a, b) => b.inicio.localeCompare(a.inicio))
  const avaliadas = new Set(db.avaliacoes.map((x) => x.agendamentoId))
  return (
    <>
      <TopBar title="Histórico" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Histórico</h1>
        <p className="mt-1 text-[15px] text-muted">Atendimentos passados, cancelados e finalizados.</p>
        {lista.length ? (
          <div className="mt-3">
            {lista.map((a) => (
              <Row
                key={a.id}
                to={`/agendamento/${a.id}`}
                overline={<StatusLabel s={a.status} aguardando={aguardandoBarbeiro(a)} />}
                title={n.servico(a)}
                subtitle={
                  <>
                    {dataHoraLonga(a.inicio)} · {n.barbearia(a)}
                    {a.status === 'Finalizado' && !avaliadas.has(a.id) && <span className="block text-[13.5px] font-medium text-amber-400">Toque para avaliar</span>}
                  </>
                }
              />
            ))}
          </div>
        ) : (
          <Empty icon={<IHistory />} title="Histórico vazio" text="Quando você cancelar ou concluir um atendimento, ele aparece aqui." />
        )}
      </Page>
    </>
  )
}
