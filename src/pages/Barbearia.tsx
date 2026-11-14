import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Capa, Empty, Field, Note, Page, Row, SearchInput, SectionTitle, TopBar, cx } from '../components/ui'
import { IHeart, IPin, IScissors, IconeServico } from '../components/Icons'
import { brl } from '../lib/format'

export default function Barbearia() {
  const { id } = useParams()
  const { db, alternarFavorito } = useApp()
  const u = useUsuario()
  const [qs, setQs] = useState('')
  const [qp, setQp] = useState('')
  const [pop, setPop] = useState(0)
  const b = db.barbearias.find((x) => x.id === id)
  if (!b) return <NaoEncontrado />

  const fav = u.favoritos.includes(b.id)
  const servicos = db.servicos.filter((s) => s.barbeariaId === b.id && s.nome.toLowerCase().includes(qs.toLowerCase()))
  const profs = db.profissionais.filter((p) => p.barbeariaId === b.id && p.nome.toLowerCase().includes(qp.toLowerCase()))
  const temAgenda = db.profissionais.some((p) => p.barbeariaId === b.id)
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.nome + ' ' + b.endereco)}`

  return (
    <>
      <TopBar title={b.nome} transparent />
      <div className="-mt-14 aspect-[16/10] w-full overflow-hidden">
        <Capa b={b} big />
      </div>
      <Page className="pt-5">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">{b.nome}</h1>
        <p className="mt-1 text-[16px] text-muted">
          {b.cidade}, {b.bairro}
        </p>

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

        <a href={mapa} target="_blank" rel="noreferrer" className="row-press mt-5 flex items-start gap-3 border-y border-line/70 py-4 text-[15.5px] leading-6 text-muted">
          <IPin size={20} className="mt-0.5 shrink-0 text-brand-ink" />
          <span>
            {b.endereco}
            <span className="mt-0.5 block text-[13.5px] font-medium text-brand-ink">Abrir no mapa</span>
          </span>
        </a>

        <div className="mt-5">
          <Note>{b.descricao}</Note>
        </div>

        {temAgenda ? (
          <>
            <SectionTitle>Serviços</SectionTitle>
            <SearchInput value={qs} onChange={setQs} />
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
                  overline={<span className="tabular-nums">{brl(s.preco)}</span>}
                  title={s.nome}
                  subtitle={`${s.descricao} · ${s.duracaoMinutos} min`}
                />
              ))}
            </div>

            <SectionTitle>Barbeiros</SectionTitle>
            <SearchInput value={qp} onChange={setQp} />
            <p className="mt-3 text-[14px] text-muted">Escolha um profissional para ver os horários livres.</p>
            <div className="mt-1">
              {profs.map((p) => (
                <Row
                  key={p.id}
                  to={`/profissional/${p.id}`}
                  leading={
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface2 text-[16px] font-semibold text-brand-ink">
                      {p.nome
                        .split(' ')
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                  }
                  title={p.nome}
                  subtitle={p.descricao}
                />
              ))}
            </div>
          </>
        ) : (
          <Empty icon={<IScissors />} title="Agenda online em breve" text="Esta unidade ainda não abriu horários no BarberHUB. Favorite para acompanhar." />
        )}
      </Page>
    </>
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

export function ServicoDetalhe() {
  const { id } = useParams()
  const { db } = useApp()
  const s = db.servicos.find((x) => x.id === id)
  if (!s) return <NaoEncontrado />
  const b = db.barbearias.find((x) => x.id === s.barbeariaId)
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
          <Field label="Duração (min)">{s.duracaoMinutos}</Field>
          <Field label="Preço (R$)">{brl(s.preco)}</Field>
          <Field label="Disponível">{s.disponivel ? <span className="text-brand-ink">✓</span> : 'Não'}</Field>
          <Field label="Categoria">{s.categoria}</Field>
          <Field label="Inclui">{s.inclui}</Field>
          <Field label="Barbearia">{b?.nome}</Field>
        </div>
        <p className="mt-6 text-[14px] text-muted">Para agendar, volte e escolha um barbeiro. O serviço é escolhido na revisão do agendamento.</p>
      </Page>
    </>
  )
}
