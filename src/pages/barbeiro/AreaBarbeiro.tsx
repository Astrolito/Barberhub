import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useUsuario } from '../../state/AppContext'
import { Button, Capa, Empty, Note, Page, Row, StatusLabel, TopBar, cx } from '../../components/ui'
import { ICalendar, ICamera, IChevron, IClock, ILock, IScissors, IStore, IUnlock } from '../../components/Icons'
import { lerImagem } from '../../lib/image'
import { dataHoraLonga, diaLocal, hora } from '../../lib/format'

function useGuard() {
  const u = useUsuario()
  return u.papel === 'Barbeiro' && u.profissionalId ? u : null
}

function SemAcesso() {
  return (
    <>
      <TopBar title="Área do barbeiro" />
      <Page>
        <Empty icon={<IScissors />} title="Acesso restrito" text="Esta área é exclusiva para barbeiros com vínculo a uma barbearia." />
      </Page>
    </>
  )
}

export default function AreaBarbeiro() {
  const u = useGuard()
  const { db } = useApp()
  if (!u) return <SemAcesso />
  const confirmados = db.agendamentos.filter((a) => a.profissionalId === u.profissionalId && a.status === 'Confirmado').length
  const cards = [
    { to: '/barbeiro/barbearia', icon: <IStore />, title: 'Minha barbearia', text: 'Detalhes e foto da unidade' },
    { to: '/barbeiro/atendimentos', icon: <ICalendar />, title: 'Atendimentos', text: confirmados ? `${confirmados} confirmado${confirmados > 1 ? 's' : ''}` : 'Nenhum pendente' },
    { to: '/barbeiro/horarios', icon: <IClock />, title: 'Meus horários', text: 'Bloquear e liberar intervalos' },
  ]
  return (
    <>
      <TopBar title="Área do barbeiro" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Área do barbeiro</h1>
        <p className="mt-1 text-[15.5px] text-muted">{db.profissionais.find((p) => p.id === u.profissionalId)?.nome}</p>
        <div className="mt-6 space-y-3">
          {cards.map((c, i) => (
            <Link key={c.to} to={c.to} className="card-press animate-fade-up flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4" style={{ animationDelay: `${i * 50}ms` }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-ink">{c.icon}</span>
              <span className="flex-1">
                <span className="block text-[16.5px] font-semibold">{c.title}</span>
                <span className="block text-[14px] text-muted">{c.text}</span>
              </span>
              <IChevron size={18} className="text-faint" />
            </Link>
          ))}
        </div>
      </Page>
    </>
  )
}

export function MinhaBarbearia() {
  const u = useGuard()
  const { db, atualizarFotoBarbearia, toast } = useApp()
  const input = useRef<HTMLInputElement>(null)
  if (!u) return <SemAcesso />
  const b = db.barbearias.find((x) => x.id === u.barbeariaId)
  if (!b) return <SemAcesso />
  return (
    <>
      <TopBar title="Minha barbearia" />
      <Page className="pt-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line">
          <Capa b={b} big />
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="md" variant="soft" icon={<ICamera size={19} />} onClick={() => input.current?.click()}>
            {b.fotoCapa ? 'Trocar foto' : 'Enviar foto'}
          </Button>
          {b.fotoCapa && (
            <Button size="md" variant="ghost" className="!w-auto" onClick={() => atualizarFotoBarbearia(b.id, undefined)}>
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
            if (!f) return
            try {
              atualizarFotoBarbearia(b.id, await lerImagem(f))
            } catch (err) {
              toast((err as Error).message, 'erro')
            }
          }}
        />
        <h1 className="mt-6 text-[24px] font-bold leading-tight">{b.nome}</h1>
        <p className="mt-2 text-[15px] leading-6 text-muted">{b.endereco}</p>
        <div className="mt-5">
          <Note>A foto aparece no catálogo, nos favoritos e na página da unidade.</Note>
        </div>
      </Page>
    </>
  )
}

export function Atendimentos() {
  const u = useGuard()
  const { db, finalizar } = useApp()
  const nav = useNavigate()
  const [aba, setAba] = useState<'confirmados' | 'historico'>('confirmados')
  const lista = useMemo(
    () =>
      u
        ? db.agendamentos
            .filter((a) => a.profissionalId === u.profissionalId)
            .filter((a) => (aba === 'confirmados' ? a.status === 'Confirmado' : a.status === 'Finalizado' || a.status === 'Cancelado'))
            .sort((a, b) => (aba === 'confirmados' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)))
        : [],
    [db, u, aba],
  )
  if (!u) return <SemAcesso />
  const nomeServ = (id: string) => db.servicos.find((s) => s.id === id)?.nome
  return (
    <>
      <TopBar title="Atendimentos" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Atendimentos</h1>
        <Segmented value={aba} onChange={setAba} options={[['confirmados', 'Confirmados'], ['historico', 'Histórico']]} />
        {lista.length ? (
          <div className="mt-2">
            {lista.map((a) => (
              <div key={a.id} className="border-b border-line/70 py-3.5 last:border-0">
                <button onClick={() => nav(`/agendamento/${a.id}`)} className="row-press block w-full text-left">
                  <div className="text-[12.5px] font-semibold">
                    <StatusLabel s={a.status} />
                  </div>
                  <div className="text-[16px] font-semibold">{nomeServ(a.servicoId)}</div>
                  <div className="text-[14.5px] text-muted">{dataHoraLonga(a.inicio)}</div>
                  <div className="text-[13.5px] text-faint">Cliente: {a.clienteEmail}</div>
                </button>
                {a.status === 'Confirmado' && (
                  <Button size="sm" className="mt-2.5" onClick={() => finalizar(a.id)}>
                    Finalizar
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty icon={<ICalendar />} title={aba === 'confirmados' ? 'Nenhum atendimento confirmado' : 'Sem histórico'} text="As reservas atribuídas a você aparecem aqui." />
        )}
      </Page>
    </>
  )
}

export function MeusHorarios() {
  const u = useGuard()
  const { db, alternarBloqueio, prepararHorarios } = useApp()
  const [dia, setDia] = useState(diaLocal())
  if (!u) return <SemAcesso />
  const lista = db.horarios
    .filter((h) => h.profissionalId === u.profissionalId && diaLocal(new Date(h.inicio)) === dia)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  return (
    <>
      <TopBar title="Meus horários" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Meus horários</h1>
        <p className="mt-1 text-[15px] text-muted">Intervalos de 90 minutos às 10h e às 14h.</p>
        <div className="mt-5 flex gap-2">
          <input
            type="date"
            min={diaLocal()}
            value={dia}
            onChange={(e) => e.target.value && setDia(e.target.value)}
            className="h-12 flex-1 rounded-xl border border-line bg-surface2 px-3.5 text-[16px] [color-scheme:dark] focus:border-brand focus:outline-none"
          />
          <Button size="md" className="!w-auto" onClick={() => prepararHorarios(u.profissionalId!, dia)}>
            Buscar horários
          </Button>
        </div>
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
          <Empty icon={<IClock />} title="Nenhum intervalo neste dia" text="Toque em Buscar horários para preparar os intervalos do dia." />
        )}
      </Page>
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
        <button key={v} onClick={() => onChange(v)} className={cx('relative z-10 text-[14.5px] font-semibold transition-colors', v === value ? 'text-ink' : 'text-muted')}>
          {l}
        </button>
      ))}
    </div>
  )
}
