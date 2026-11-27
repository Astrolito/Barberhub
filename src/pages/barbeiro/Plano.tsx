import { useState } from 'react'
import { useApp, useUsuario } from '../../state/AppContext'
import { Button, Empty, Note, Page, SectionTitle, SeloParceira, TopBar, cx } from '../../components/ui'
import { ICheck, IScissors } from '../../components/Icons'
import { brlFull, dataLonga } from '../../lib/format'
import {
  DESCONTOS_PARCERIA,
  PERIODOS_PARCERIA,
  assinaturaDe,
  parceriaAberta,
  parceriaVigente,
  situacaoAssinatura,
  type SituacaoAssinatura,
} from '../../domain/rules'

const ROTULO: Record<SituacaoAssinatura, { texto: string; cor: string }> = {
  Teste: { texto: 'Teste grátis', cor: 'bg-brand/15 text-brand-ink' },
  Ativa: { texto: 'Ativa', cor: 'bg-emerald-400/15 text-emerald-300' },
  Pendente: { texto: 'Aguardando pagamento', cor: 'bg-amber-400/15 text-amber-300' },
  Cancelada: { texto: 'Cancelada', cor: 'bg-surface2 text-muted' },
  Vencida: { texto: 'Vencida', cor: 'bg-red-500/15 text-red-300' },
  'Sem assinatura': { texto: 'Sem assinatura', cor: 'bg-surface2 text-muted' },
}

const data = (iso?: string) => (iso ? dataLonga(iso) : '—')

/** RF15 a RF17: plano da barbearia (assinatura mensal) e parceria com a plataforma. */
export default function PlanoBarbearia() {
  const u = useUsuario()
  const { db, modo, escolherPlano, cancelarAssinatura, solicitarParceria, encerrarParceria, simularEquipe } = useApp()
  const [enviando, setEnviando] = useState(false)
  const [desconto, setDesconto] = useState(15)
  const [dias, setDias] = useState(30)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)

  if (u.papel !== 'Barbeiro' || !u.barbeariaId)
    return (
      <>
        <TopBar title="Plano e parceria" />
        <Page>
          <Empty icon={<IScissors />} title="Acesso restrito" text="Esta área é exclusiva para barbeiros com vínculo a uma barbearia." />
        </Page>
      </>
    )

  const a = assinaturaDe(db, u.barbeariaId)
  const situacao = situacaoAssinatura(a)
  const emDia = situacao !== 'Vencida' && situacao !== 'Sem assinatura'
  const plano = db.planos.find((p) => p.id === a?.planoId)
  const equipe = db.profissionais.filter((p) => p.barbeariaId === u.barbeariaId).length
  const vigente = parceriaVigente(db, u.barbeariaId)
  const aberta = parceriaAberta(db, u.barbeariaId)
  const historico = db.parcerias
    .filter((p) => p.barbeariaId === u.barbeariaId && p.id !== aberta?.id)
    .sort((x, y) => y.criadoEm.localeCompare(x.criadoEm))
    .slice(0, 5)

  const fazer = async (fn: () => Promise<unknown>) => {
    setEnviando(true)
    await fn()
    setEnviando(false)
  }

  return (
    <>
      <TopBar title="Plano e parceria" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Plano e parceria</h1>

        {/* Situação da assinatura */}
        <section className="mt-5 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13px] font-semibold uppercase tracking-wide text-faint">Sua assinatura</div>
            <span className={cx('rounded-full px-2.5 py-1 text-[12.5px] font-semibold', ROTULO[situacao].cor)}>{ROTULO[situacao].texto}</span>
          </div>
          <div className="mt-2 text-[22px] font-bold">{plano ? `Plano ${plano.nome}` : 'Nenhum plano'}</div>
          {plano && <div className="text-[15px] text-muted">{brlFull(plano.precoMensal)} por mês</div>}
          <p className="mt-3 text-[14.5px] leading-[21px] text-muted">
            {situacao === 'Teste' && <>Teste grátis até <b className="text-ink">{data(a?.validaAte)}</b>. Depois disso, a cobrança do plano começa.</>}
            {situacao === 'Ativa' && <>Pago até <b className="text-ink">{data(a?.validaAte)}</b>.</>}
            {situacao === 'Pendente' && <>Plano escolhido. A equipe BarberHUB envia a cobrança (Pix ou boleto) e ativa assim que o pagamento for confirmado. Sua barbearia segue no ar até <b className="text-ink">{data(a?.validaAte)}</b>.</>}
            {situacao === 'Cancelada' && <>Não renova. Sua barbearia segue no ar até <b className="text-ink">{data(a?.validaAte)}</b>; para voltar, escolha um plano abaixo.</>}
            {situacao === 'Vencida' && <>Venceu em {data(a?.validaAte)}. Sua barbearia <b className="text-ink">saiu da busca e do mapa</b> e não recebe reservas novas. Escolha um plano para renovar.</>}
            {situacao === 'Sem assinatura' && <>Escolha um plano para sua barbearia aparecer na busca e receber reservas.</>}
          </p>
        </section>

        {/* Planos */}
        <SectionTitle>Planos</SectionTitle>
        <div className="space-y-2.5">
          {[...db.planos]
            .sort((x, y) => x.ordem - y.ordem)
            .map((p) => {
              const atual = p.id === a?.planoId && situacao !== 'Vencida' && situacao !== 'Cancelada'
              const naoCabe = p.maxProfissionais > 0 && equipe > p.maxProfissionais
              return (
                <div key={p.id} className={cx('rounded-[20px] border p-4', atual ? 'border-brand bg-brand/[0.07]' : 'border-line bg-surface')}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[17px] font-semibold">{p.nome}</div>
                    <div className="text-[17px] font-bold tabular-nums">
                      {brlFull(p.precoMensal)}
                      <span className="text-[13px] font-medium text-muted">/mês</span>
                    </div>
                  </div>
                  <p className="mt-1 text-[14px] leading-5 text-muted">{p.descricao}</p>
                  <ul className="mt-2 space-y-1 text-[14px]">
                    <li className="flex items-center gap-2">
                      <ICheck size={16} className="text-brand-ink" />
                      {p.maxProfissionais ? `Até ${p.maxProfissionais} barbeiros` : 'Barbeiros ilimitados'}
                    </li>
                    <li className="flex items-center gap-2">
                      <ICheck size={16} className="text-brand-ink" />
                      Agenda online, mapa, lembretes e avaliações
                    </li>
                    <li className="flex items-center gap-2">
                      <ICheck size={16} className="text-brand-ink" />
                      Pode virar parceira BarberHUB
                    </li>
                  </ul>
                  {atual ? (
                    <div className="mt-3 text-[14px] font-semibold text-brand-ink">Plano atual</div>
                  ) : (
                    <Button
                      size="md"
                      variant={naoCabe ? 'ghost' : 'soft'}
                      className="mt-3"
                      disabled={enviando || naoCabe}
                      onClick={() => fazer(() => escolherPlano(p.id))}
                    >
                      {naoCabe ? `Sua equipe tem ${equipe} barbeiros` : situacao === 'Vencida' || situacao === 'Cancelada' ? 'Assinar este plano' : 'Mudar para este plano'}
                    </Button>
                  )}
                </div>
              )
            })}
        </div>
        <p className="mt-3 text-[13px] leading-[19px] text-faint">
          Barbearia nova começa com 30 dias de teste grátis. Sem cartão no app: a cobrança é enviada pela equipe BarberHUB.
        </p>
        {(situacao === 'Ativa' || situacao === 'Teste' || situacao === 'Pendente') &&
          (confirmarCancelar ? (
            <div className="mt-3 rounded-2xl border border-line bg-surface p-4 text-[14.5px]">
              Cancelar a assinatura? Sua barbearia segue no ar até {data(a?.validaAte)} e depois sai da busca.
              <div className="mt-3 flex gap-2">
                <Button size="md" variant="soft" className="!w-auto" disabled={enviando} onClick={() => fazer(async () => (await cancelarAssinatura()) && setConfirmarCancelar(false))}>
                  Cancelar assinatura
                </Button>
                <Button size="md" variant="ghost" className="!w-auto" onClick={() => setConfirmarCancelar(false)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <button className="mt-3 text-[14px] font-medium text-muted underline-offset-2 hover:underline" onClick={() => setConfirmarCancelar(true)}>
              Cancelar assinatura
            </button>
          ))}

        {/* Parceria */}
        <SectionTitle>Parceria BarberHUB</SectionTitle>
        <p className="text-[14.5px] leading-[21px] text-muted">
          Ofereça um preço diferenciado para quem agenda pelo app. Em troca, sua barbearia aparece na seção <b className="text-ink">Parceiras BarberHUB</b> do Início, com o selo{' '}
          <SeloParceira className="align-middle" /> no catálogo, no mapa e na sua página. A ordem por distância não muda.
        </p>

        {aberta ? (
          <div className="mt-4 rounded-[20px] border border-amber-400/40 bg-amber-400/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <SeloParceira pct={aberta.descontoPct} />
              <span className="text-[13px] font-semibold text-amber-300">{vigente ? 'Em vigor' : 'Em análise'}</span>
            </div>
            <p className="mt-2 text-[14.5px] leading-[21px]">
              {vigente ? (
                <>
                  {aberta.descontoPct}% de desconto em todos os serviços agendados pelo app, até <b>{data(aberta.fim)}</b>. Os clientes já veem o preço com desconto.
                </>
              ) : (
                <>
                  Pedido de {aberta.descontoPct}% por {aberta.dias} dias enviado em {data(aberta.criadoEm)}. A equipe BarberHUB analisa em até 1 dia útil; o destaque começa quando for aprovado.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="md" variant="ghost" className="!w-auto" disabled={enviando} onClick={() => fazer(() => encerrarParceria(aberta.id, !vigente))}>
                {vigente ? 'Encerrar parceria' : 'Cancelar pedido'}
              </Button>
              {modo === 'local' && !vigente && simularEquipe && (
                <Button size="md" variant="soft" className="!w-auto" disabled={enviando} onClick={() => fazer(simularEquipe)}>
                  Simular aprovação (demonstração)
                </Button>
              )}
            </div>
          </div>
        ) : emDia ? (
          <div className="mt-4 rounded-[20px] border border-line bg-surface p-4">
            <div className="text-[15px] font-semibold">Desconto para clientes do app</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {DESCONTOS_PARCERIA.map((d) => (
                <Chip key={d} on={desconto === d} onClick={() => setDesconto(d)}>
                  {d}%
                </Chip>
              ))}
            </div>
            <div className="mt-4 text-[15px] font-semibold">Período</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PERIODOS_PARCERIA.map((d) => (
                <Chip key={d} on={dias === d} onClick={() => setDias(d)}>
                  {d} dias
                </Chip>
              ))}
            </div>
            <ExemploPreco desconto={desconto} barbeariaId={u.barbeariaId} />
            <Button className="mt-4" disabled={enviando} onClick={() => fazer(() => solicitarParceria(desconto, dias))}>
              Quero ser parceira
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Note>Renove a assinatura para virar parceira.</Note>
          </div>
        )}

        {modo === 'local' && situacao === 'Pendente' && simularEquipe && (
          <Button size="md" variant="soft" className="mt-4" disabled={enviando} onClick={() => fazer(simularEquipe)}>
            Simular pagamento confirmado (demonstração)
          </Button>
        )}

        {historico.length > 0 && (
          <>
            <SectionTitle>Parcerias anteriores</SectionTitle>
            <div className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
              {historico.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[14.5px]">
                  <span>
                    {p.descontoPct}% · {p.dias} dias
                    <span className="block text-[13px] text-muted">{p.inicio ? `${data(p.inicio)} a ${data(p.fim)}` : `Pedido em ${data(p.criadoEm)}`}</span>
                  </span>
                  <span className="text-[13px] font-semibold text-muted">{p.status === 'Ativa' ? 'Encerrada' : p.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Page>
    </>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'press h-9 rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-150',
        on ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-line bg-surface2 text-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** Mostra como fica o preço de um serviço da unidade com o desconto escolhido. */
function ExemploPreco({ desconto, barbeariaId }: { desconto: number; barbeariaId: string }) {
  const { db } = useApp()
  const s = db.servicos.find((x) => x.barbeariaId === barbeariaId && x.disponivel)
  if (!s) return null
  const novo = Math.round(s.preco * (100 - desconto)) / 100
  return (
    <p className="mt-4 rounded-xl bg-surface2/70 px-3 py-2.5 text-[14px] text-muted">
      Exemplo: {s.nome} de <span className="line-through">{brlFull(s.preco)}</span> por <b className="text-amber-300">{brlFull(novo)}</b> no app.
    </p>
  )
}
