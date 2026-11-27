import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Capa, Empty, Estrelas, Field, Note, Page, PrecoApp, Row, SearchInput, SectionTitle, SeloParceira, TopBar, cx } from '../components/ui'
import { IChat, IClock, IHeart, IPhone, IPin, IRepeat, IScissors, IconeServico } from '../components/Icons'
import { brl, dataLonga } from '../lib/format'
import { barbeariaVisivel, jornadaDe, notaDaBarbearia, parceriaVigente, precoNoApp, resumoJornada } from '../domain/rules'
import type { Barbearia as TBarbearia, Profissional } from '../domain/types'

const fone = (d: string) => (d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`)

/** Botões de WhatsApp e ligação, quando a unidade cadastrou. */
export function Contato({ b }: { b: TBarbearia }) {
  if (!b.whatsapp && !b.telefone) return null
  return (
    <div className="mt-3 grid grid-cols-2 gap-2.5">
      {b.whatsapp && (
        <a href={`https://wa.me/55${b.whatsapp}`} target="_blank" rel="noreferrer" className={cx('press flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f2e1d] text-[15px] font-semibold text-[#4ade80]', !b.telefone && 'col-span-2')}>
          <IChat size={19} /> WhatsApp
        </a>
      )}
      {b.telefone && (
        <a href={`tel:+55${b.telefone}`} className={cx('press flex h-11 items-center justify-center gap-2 rounded-xl bg-surface2 text-[15px] font-semibold', !b.whatsapp && 'col-span-2')}>
          <IPhone size={19} /> {fone(b.telefone)}
        </a>
      )}
    </div>
  )
}

/** Horário de atendimento da unidade: junta a agenda de todos os barbeiros. */
function funcionamento(profs: Profissional[]) {
  const js = profs.map(jornadaDe)
  return resumoJornada({
    dias: [...new Set(js.flatMap((j) => j.dias))].sort(),
    inicio: js.map((j) => j.inicio).sort()[0],
    fim: js.map((j) => j.fim).sort().reverse()[0],
    intervaloMin: 0,
  })
}

export const iniciais = (nome: string) =>
  nome
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')

export default function Barbearia() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const remarcar = params.get('remarcar')
  const { db, alternarFavorito } = useApp()
  const u = useUsuario()
  const [qs, setQs] = useState('')
  const [qp, setQp] = useState('')
  const [pop, setPop] = useState(0)
  const b = db.barbearias.find((x) => x.id === id)
  if (!b) return <NaoEncontrado />

  const fav = u.favoritos.includes(b.id)
  const servicos = db.servicos.filter((s) => s.barbeariaId === b.id && s.disponivel && s.nome.toLowerCase().includes(qs.toLowerCase()))
  const todosProfs = db.profissionais.filter((p) => p.barbeariaId === b.id)
  const profs = todosProfs.filter((p) => p.nome.toLowerCase().includes(qp.toLowerCase()))
  const emDia = barbeariaVisivel(b)
  const temAgenda = todosProfs.length > 0 && emDia
  const parceria = parceriaVigente(db, b.id)
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.nome + ' ' + b.endereco)}`
  const nota = notaDaBarbearia(db, b.id)
  const avaliacoes = db.avaliacoes
    .filter((a) => a.barbeariaId === b.id)
    .sort((x, y) => y.criadoEm.localeCompare(x.criadoEm))
    .slice(0, 5)
  const sufixo = remarcar ? `?remarcar=${remarcar}` : ''

  return (
    <>
      <TopBar title={b.nome} transparent />
      <div className="-mt-14 aspect-[16/10] w-full overflow-hidden">
        <Capa b={b} big />
      </div>
      <Page className="pt-5">
        {remarcar && (
          <div className="animate-fade-up mb-5 flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand-soft p-4 text-[15px]">
            <IRepeat className="shrink-0 text-brand-ink" />
            Remarcando sua reserva. Escolha o barbeiro e o novo horário.
          </div>
        )}
        {parceria && <SeloParceira className="mb-2" />}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">{b.nome}</h1>
        <p className="mt-1 text-[16px] text-muted">
          {b.cidade}, {b.bairro}
        </p>
        {parceria && (
          <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3.5 text-[14.5px] leading-[21px] text-amber-100">
            <b className="font-semibold text-amber-300">Parceira BarberHUB:</b> {parceria.descontoPct}% de desconto em todos os serviços agendados pelo app
            {parceria.fim ? `, até ${new Date(parceria.fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}.
          </div>
        )}
        {nota && (
          <a href="#avaliacoes" className="mt-2 flex items-center gap-2 text-[14.5px] text-muted">
            <Estrelas valor={nota.media} size={16} />
            <span className="font-semibold text-ink">{nota.media.toFixed(1).replace('.', ',')}</span>
            <span>
              ({nota.total} {nota.total === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </a>
        )}

        {!remarcar && (
          <button
            onClick={() => {
              alternarFavorito(b.id)
              setPop((x) => x + 1)
            }}
            aria-pressed={fav}
            className={cx(
              'press mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold transition-colors duration-150',
              fav ? 'bg-danger-soft text-red-300' : 'bg-brand-soft/70 text-brand-ink',
            )}
          >
            <span key={pop} className={cx(pop > 0 && 'animate-heart-pop', fav && 'text-danger')}>
              <IHeart filled={fav} size={22} />
            </span>
            {fav ? 'Favoritada' : 'Favoritar'}
          </button>
        )}
        <Contato b={b} />

        <a href={mapa} target="_blank" rel="noreferrer" className="row-press mt-5 flex items-start gap-3 border-t border-line/70 py-4 text-[15.5px] leading-6 text-muted">
          <IPin size={20} className="mt-0.5 shrink-0 text-brand-ink" />
          <span>
            {b.endereco}
            <span className="mt-0.5 block text-[13.5px] font-medium text-brand-ink">Abrir no mapa</span>
          </span>
        </a>
        {temAgenda && (
          <div className="flex items-start gap-3 border-y border-line/70 py-4 text-[15.5px] leading-6 text-muted">
            <IClock size={20} className="mt-0.5 shrink-0 text-brand-ink" />
            <span>
              {funcionamento(todosProfs)}
              <span className="mt-0.5 block text-[13.5px] text-faint">Horário de atendimento com reserva</span>
            </span>
          </div>
        )}

        {b.descricao && (
          <div className="mt-5">
            <Note>{b.descricao}</Note>
          </div>
        )}

        {temAgenda ? (
          <>
            {!remarcar && (
              <>
                <SectionTitle>Serviços</SectionTitle>
                <SearchInput value={qs} onChange={setQs} />
                <p className="mt-3 text-[14px] text-muted">Toque num serviço para ver os detalhes e agendar.</p>
                <div className="mt-1">
                  {servicos.map((s) => (
                    <Row
                      key={s.id}
                      to={`/servico/${s.id}`}
                      leading={
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-soft">
                          <IconeServico tipo={s.icone} size={34} />
                        </span>
                      }
                      overline={<span className="tabular-nums"><PrecoApp {...precoNoApp(db, s)} formatar={brl} /></span>}
                      title={s.nome}
                      subtitle={[s.descricao, `${s.duracaoMinutos} min`].filter(Boolean).join(' · ')}
                    />
                  ))}
                </div>
              </>
            )}

            <SectionTitle>Barbeiros</SectionTitle>
            <SearchInput value={qp} onChange={setQp} />
            <p className="mt-3 text-[14px] text-muted">Escolha um profissional para ver os horários livres.</p>
            <ListaProfissionais profs={profs} sufixo={sufixo} />

            {avaliacoes.length > 0 && (
              <>
                <SectionTitle>
                  <span id="avaliacoes">Avaliações</span>
                </SectionTitle>
                <div className="space-y-3">
                  {avaliacoes.map((a) => (
                    <div key={a.id} className="rounded-2xl border border-line bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-semibold">{a.clienteNome}</span>
                        <Estrelas valor={a.nota} size={15} />
                      </div>
                      {a.comentario && <p className="mt-1.5 text-[15px] leading-6 text-zinc-300">{a.comentario}</p>}
                      <div className="mt-1.5 text-[12.5px] text-faint">
                        {dataLonga(a.criadoEm)} · com {db.profissionais.find((p) => p.id === a.profissionalId)?.nome}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <Empty
            icon={<IScissors />}
            title={emDia ? 'Agenda online em breve' : 'Reservas pausadas'}
            text={
              emDia
                ? 'Esta unidade ainda não abriu horários no BarberHUB. Favorite para acompanhar.'
                : 'Esta barbearia não está recebendo reservas pelo app no momento. Favorite para acompanhar.'
            }
          />
        )}
      </Page>
    </>
  )
}

function ListaProfissionais({ profs, sufixo }: { profs: Profissional[]; sufixo: string }) {
  return (
    <div className="mt-1">
      {profs.map((p) => (
        <Row
          key={p.id}
          to={`/profissional/${p.id}${sufixo}`}
          leading={<span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface2 text-[16px] font-semibold text-brand-ink">{iniciais(p.nome)}</span>}
          title={p.nome}
          subtitle={resumoJornada(jornadaDe(p))}
        />
      ))}
    </div>
  )
}

export function NaoEncontrado() {
  return (
    <>
      <TopBar title="" />
      <Page>
        <Empty icon={<IScissors />} title="Não encontrado" text="Este item não existe mais ou o link está incorreto." />
      </Page>
    </>
  )
}

/** Detalhe do serviço e, abaixo, os barbeiros para agendar já com ele escolhido. */
export function ServicoDetalhe() {
  const { id } = useParams()
  const { db } = useApp()
  const s = db.servicos.find((x) => x.id === id)
  if (!s) return <NaoEncontrado />
  const b = db.barbearias.find((x) => x.id === s.barbeariaId)
  const profs = db.profissionais.filter((p) => p.barbeariaId === s.barbeariaId)
  return (
    <>
      <TopBar title={s.nome} />
      <div className="grid aspect-[16/9] w-full place-items-center bg-brand-soft">
        <IconeServico tipo={s.icone} size={150} />
      </div>
      <Page className="pt-6">
        <h1 className="text-[28px] font-bold tracking-tight">{s.nome}</h1>
        <p className="mt-1 text-[16px] text-muted">{s.descricao}</p>
        <div className="mt-5">
          <Field label="Duração">{s.duracaoMinutos} min</Field>
          <Field label="Preço">
            <PrecoApp {...precoNoApp(db, s)} formatar={(v) => `R$ ${brl(v)}`} />
          </Field>
          {s.categoria && <Field label="Categoria">{s.categoria}</Field>}
          {s.inclui && <Field label="Inclui">{s.inclui}</Field>}
          <Field label="Barbearia">{b ? <Link to={`/barbearia/${b.id}`} className="text-brand-ink">{b.nome}</Link> : '—'}</Field>
        </div>
        {s.disponivel && b && barbeariaVisivel(b) ? (
          <>
            <SectionTitle>Agendar com</SectionTitle>
            <ListaProfissionais profs={profs} sufixo={`?servico=${s.id}`} />
          </>
        ) : (
          <div className="mt-6">
            <Note>{s.disponivel ? 'Esta barbearia não está recebendo reservas pelo app no momento.' : 'Este serviço está indisponível no momento.'}</Note>
          </div>
        )}
      </Page>
    </>
  )
}
