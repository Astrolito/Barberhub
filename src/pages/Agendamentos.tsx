import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Empty, Field, Page, Row, SearchInput, Sheet, StatusLabel, TopBar } from '../components/ui'
import { ICalendar, ICheck, IHistory, IX } from '../components/Icons'
import { NaoEncontrado } from './Barbearia'
import { noHistorico, terminoServico } from '../domain/rules'
import { brlFull, dataHoraLonga, hora } from '../lib/format'
import type { Agendamento } from '../domain/types'

function useNomes() {
  const { db } = useApp()
  return {
    servico: (a: Agendamento) => db.servicos.find((s) => s.id === a.servicoId)?.nome ?? 'Serviço',
    barbearia: (a: Agendamento) => db.barbearias.find((s) => s.id === a.barbeariaId)?.nome ?? '',
    prof: (a: Agendamento) => db.profissionais.find((s) => s.id === a.profissionalId)?.nome ?? '',
  }
}

/** Agenda inferior: reservas confirmadas feitas OU recebidas pela conta (correção de 21/10). */
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
        .filter((a) => `${n.servico(a)} ${n.barbearia(a)} ${n.prof(a)} ${dataHoraLonga(a.inicio)}`.toLowerCase().includes(q.toLowerCase()))
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
                    {a.clienteEmail === u.email ? n.barbearia(a) : `Atendimento recebido · ${n.barbearia(a)}`}
                  </span>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <Empty
          icon={<ICalendar />}
          title={q ? 'Nada encontrado' : 'Nenhuma reserva confirmada'}
          text={q ? 'Tente outro termo de busca.' : 'Suas reservas confirmadas aparecem aqui. Escolha uma barbearia para agendar.'}
          action={!q && <Button size="md" onClick={() => nav('/')}>Explorar barbearias</Button>}
        />
      )}
    </Page>
  )
}

export function AgendamentoDetalhe() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { db, cancelar, finalizar } = useApp()
  const u = useUsuario()
  const n = useNomes()
  const [confirmarCancel, setConfirmarCancel] = useState(false)
  const a = db.agendamentos.find((x) => x.id === id)
  if (!a || (a.clienteEmail !== u.email && a.profissionalId !== u.profissionalId)) return <NaoEncontrado />

  const ehTitular = a.clienteEmail === u.email
  const ehBarbeiro = u.papel === 'Barbeiro' && u.profissionalId === a.profissionalId
  const preco = a.precoReservado ?? db.servicos.find((s) => s.id === a.servicoId)?.preco
  const fimServico = terminoServico(db, a)

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
              <div className="text-[16px] font-semibold">Reserva confirmada</div>
              <div className="text-[14px] text-zinc-300">Pagamento no estabelecimento. Chegue com 10 min de antecedência.</div>
            </div>
          </div>
        )}
        <h1 className="text-[28px] font-bold tracking-tight">Agendamento</h1>
        <p className="mt-1 text-[16px]">
          <StatusLabel s={a.status} />
        </p>

        {a.status === 'Confirmado' && ehTitular && (
          <Button variant="danger" className="mt-5" icon={<IX size={20} />} onClick={() => setConfirmarCancel(true)}>
            Cancelar
          </Button>
        )}
        {a.status === 'Confirmado' && ehBarbeiro && (
          <Button className="mt-3" icon={<ICheck size={20} />} onClick={() => finalizar(a.id)}>
            Finalizar atendimento
          </Button>
        )}

        <h2 className="mt-8 text-[20px] font-bold">Detalhes do agendamento</h2>
        <div className="mt-2">
          <Field label="Protocolo">
            <span className="break-all font-mono text-[13.5px]">{a.protocolo}</span>
          </Field>
          <Field label="Status">{a.status}</Field>
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

      <Sheet open={confirmarCancel} onClose={() => setConfirmarCancel(false)} title="Cancelar reserva?">
        <p className="pt-2 text-[15.5px] leading-6 text-muted">
          {n.servico(a)} em {dataHoraLonga(a.inicio)} com {n.prof(a)}. O horário será liberado para outras pessoas e a reserva ficará no seu histórico.
        </p>
        <div className="mt-6 space-y-2.5">
          <Button
            variant="danger"
            onClick={() => {
              cancelar(a.id)
              setConfirmarCancel(false)
            }}
          >
            Sim, cancelar reserva
          </Button>
          <Button variant="ghost" onClick={() => setConfirmarCancel(false)}>
            Manter reserva
          </Button>
        </div>
      </Sheet>
    </>
  )
}

export function Historico() {
  const { db } = useApp()
  const u = useUsuario()
  const n = useNomes()
  const lista = db.agendamentos.filter((a) => a.clienteEmail === u.email && noHistorico(a)).sort((a, b) => b.inicio.localeCompare(a.inicio))
  return (
    <>
      <TopBar title="Histórico" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Histórico</h1>
        <p className="mt-1 text-[15px] text-muted">Reservas canceladas e atendimentos finalizados.</p>
        {lista.length ? (
          <div className="mt-3">
            {lista.map((a) => (
              <Row key={a.id} to={`/agendamento/${a.id}`} overline={<StatusLabel s={a.status} />} title={n.servico(a)} subtitle={`${dataHoraLonga(a.inicio)} · ${n.barbearia(a)}`} />
            ))}
          </div>
        ) : (
          <Empty icon={<IHistory />} title="Histórico vazio" text="Quando você cancelar ou concluir um atendimento, ele aparece aqui." />
        )}
      </Page>
    </>
  )
}
