import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../state/AppContext'
import { Button, Campo, Empty, Note, Page, Row, Sheet, TopBar, cx, inputCls } from '../../components/ui'
import { ICalendar, IClock, IPlus, IUsers } from '../../components/Icons'
import { assinaturaDe, equipeAtiva, jornadaDe, resumoJornada, type ProfissionalEditavel } from '../../domain/rules'
import type { MembroEquipe } from '../../domain/types'
import { SemAcesso, useDono } from './AreaBarbeiro'

const iniciais = (nome: string) =>
  nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

/** Dono da barbearia: adiciona, edita e remove barbeiros, convida pelo e-mail e abre a agenda de cada um. */
export default function Equipe() {
  const u = useDono()
  const { db, equipe: carregarEquipe, salvarProfissional, removerProfissional } = useApp()
  const nav = useNavigate()
  const [membros, setMembros] = useState<MembroEquipe[]>([])
  const [editando, setEditando] = useState<ProfissionalEditavel | null>(null)
  const [confirmarRemocao, setConfirmarRemocao] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const lista = equipeAtiva(db, u?.barbeariaId)
  const chave = lista.map((p) => p.id).join(',')
  const atualizar = useCallback(async () => {
    const r = await carregarEquipe()
    if (r) setMembros(r)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (u) atualizar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u?.id, chave])

  if (!u) return <SemAcesso dono />

  const plano = db.planos.find((p) => p.id === assinaturaDe(db, u.barbeariaId)?.planoId)
  const limite = plano?.maxProfissionais ?? 0
  const cheio = limite > 0 && lista.length >= limite
  const membro = (id: string) => membros.find((m) => m.profissionalId === id)
  const ehEu = editando?.id === u.profissionalId

  const abrir = (id?: string) => {
    setConfirmarRemocao(false)
    if (!id) return setEditando({ nome: '', descricao: 'Atendimento com horário marcado.', especialidades: '', email: '' })
    const p = lista.find((x) => x.id === id)!
    setEditando({ id: p.id, nome: p.nome, descricao: p.descricao, especialidades: p.especialidades, email: membro(p.id)?.email ?? '' })
  }

  return (
    <>
      <TopBar
        title="Equipe"
        right={
          <Button size="sm" variant="soft" icon={<IPlus size={16} />} disabled={cheio} onClick={() => abrir()}>
            Novo
          </Button>
        }
      />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Equipe</h1>
        <p className="mt-1 text-[15px] text-muted">
          {lista.length} barbeiro{lista.length === 1 ? '' : 's'}
          {plano ? ` · plano ${plano.nome} ${limite ? `(até ${limite})` : '(ilimitado)'}` : ''}
        </p>
        {cheio && (
          <Link to="/barbeiro/plano" className="press mt-3 block rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-[14.5px] font-medium text-amber-200">
            Sua equipe chegou ao limite do plano. Troque de plano para adicionar mais barbeiros.
          </Link>
        )}

        <div className="mt-3">
          {lista.map((p) => {
            const m = membro(p.id)
            const situacao = m?.dono ? 'Dono' : !m?.email ? 'Sem acesso ao app' : m.temConta ? 'Acesso ativo' : 'Convite enviado'
            return (
              <div key={p.id} className="border-b border-line/70 py-1 last:border-0">
                <Row
                  onClick={() => abrir(p.id)}
                  leading={
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-[16px] font-bold text-brand-ink">{iniciais(p.nome)}</span>
                  }
                  overline={<span className={cx(m?.dono && 'text-brand-ink', situacao === 'Convite enviado' && 'text-amber-300', situacao === 'Sem acesso ao app' && 'text-faint')}>{situacao}</span>}
                  title={p.id === u.profissionalId ? `${p.nome} (você)` : p.nome}
                  subtitle={
                    <>
                      {resumoJornada(jornadaDe(p))}
                      {m?.email && <span className="block truncate text-[13px] text-faint">{m.email}</span>}
                    </>
                  }
                />
                <div className="mb-2 ml-16 flex gap-2">
                  <Button size="sm" variant="ghost" className="!w-auto" icon={<ICalendar size={16} />} onClick={() => nav(p.id === u.profissionalId ? '/barbeiro/agenda' : `/barbeiro/agenda?prof=${p.id}`)}>
                    Agenda
                  </Button>
                  <Button size="sm" variant="ghost" className="!w-auto" icon={<IClock size={16} />} onClick={() => nav(p.id === u.profissionalId ? '/barbeiro/horarios' : `/barbeiro/horarios?prof=${p.id}`)}>
                    Horários
                  </Button>
                  <Button size="sm" variant="ghost" className="!w-auto" onClick={() => nav(`/barbeiro/atendimentos?prof=${p.id}`)}>
                    Reservas
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        {!lista.length && <Empty icon={<IUsers />} title="Nenhum barbeiro" text="Adicione o primeiro barbeiro para abrir a agenda aos clientes." />}

        <div className="mt-5">
          <Note>Convide pelo e-mail: quando o barbeiro entrar no BarberHUB com ele, a conta já abre na área do barbeiro, vinculada à sua unidade. Cada barbeiro cuida da própria agenda; você pode ajustar a de qualquer um.</Note>
        </div>
      </Page>

      <Sheet open={!!editando} onClose={() => setEditando(null)} title={editando?.id ? 'Editar barbeiro' : 'Novo barbeiro'}>
        {editando && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setEnviando(true)
              const r = await salvarProfissional(editando)
              setEnviando(false)
              if (r) {
                setEditando(null)
                atualizar()
              }
            }}
          >
            <Campo label="Nome">
              <input value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} maxLength={60} className={inputCls} placeholder="Nome do barbeiro" />
            </Campo>
            <Campo label="E-mail de acesso" dica={ehEu ? 'Seu e-mail de acesso não muda por aqui.' : 'Opcional. É o convite: com ele o barbeiro entra no app e vê a própria agenda. Apagar tira o acesso.'}>
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={editando.email ?? ''}
                disabled={ehEu}
                onChange={(e) => setEditando({ ...editando, email: e.target.value })}
                className={inputCls}
                placeholder="barbeiro@email.com"
              />
            </Campo>
            <Campo label="Especialidades">
              <input value={editando.especialidades} onChange={(e) => setEditando({ ...editando, especialidades: e.target.value })} maxLength={120} className={inputCls} placeholder="Corte, barba, pezinho" />
            </Campo>
            <Campo label="Descrição">
              <input value={editando.descricao} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} maxLength={200} className={inputCls} />
            </Campo>
            <Button className="mt-6" disabled={enviando}>
              {enviando ? 'Salvando…' : editando.id ? 'Salvar' : 'Adicionar à equipe'}
            </Button>
            {editando.id && !ehEu && (
              <div className="mt-3">
                {confirmarRemocao ? (
                  <div className="rounded-xl border border-danger/40 bg-red-500/10 p-3.5">
                    <p className="text-[14.5px] leading-5 text-red-200">
                      {editando.nome} sai do catálogo e perde o acesso. Reservas antigas e avaliações continuam no histórico.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="!w-auto text-danger"
                        disabled={enviando}
                        onClick={async () => {
                          setEnviando(true)
                          const ok = await removerProfissional(editando.id!)
                          setEnviando(false)
                          if (ok) {
                            setEditando(null)
                            atualizar()
                          }
                        }}
                      >
                        Remover da equipe
                      </Button>
                      <Button type="button" size="sm" variant="ghost" className="!w-auto" onClick={() => setConfirmarRemocao(false)}>
                        Manter
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirmarRemocao(true)}>
                    Remover barbeiro
                  </Button>
                )}
              </div>
            )}
          </form>
        )}
      </Sheet>
    </>
  )
}
