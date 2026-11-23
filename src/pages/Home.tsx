import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Capa, Note, Page, SearchInput, Switch, cx } from '../components/ui'
import { ILocate, ILocateOff, IMap, IPin, ISearch, IStar } from '../components/Icons'
import { OPCOES_DISTANCIA } from '../data/seed'
import { notaDaBarbearia, raioAplicado } from '../domain/rules'
import { BAIRROS, capturarGps, distanciaKm, geocodificarEndereco, gpsIndisponivel, pontoDoBairro } from '../lib/geo'
import { km, primeiroNome } from '../lib/format'
import type { Barbearia } from '../domain/types'

export default function Home() {
  const { db, atualizarUsuario, toast } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const [busca, setBusca] = useState('')
  const [endereco, setEndereco] = useState(u.localizacao?.origem === 'endereco' ? u.localizacao.rotulo : '')
  const [carregando, setCarregando] = useState<'gps' | 'endereco' | null>(null)

  const semGps = useMemo(gpsIndisponivel, [])
  const raio = raioAplicado(u)
  const ref = u.localizacao

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    let itens = db.barbearias
      .filter((b) => b.cidade === 'Manaus')
      .map((b) => ({ b, dist: ref ? distanciaKm(ref, b) : undefined }))
    if (ref) itens = itens.filter((x) => raio === 0 || (x.dist ?? 0) <= raio).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))
    if (q) itens = itens.filter(({ b }) => `${b.nome} ${b.bairro}`.toLowerCase().includes(q))
    return itens
  }, [db.barbearias, busca, ref, raio])

  async function ligarGps(on: boolean) {
    if (!on) {
      atualizarUsuario({ localizacao: undefined })
      return
    }
    setCarregando('gps')
    try {
      const p = await capturarGps()
      atualizarUsuario({ localizacao: p })
      setEndereco('')
      toast('Localização capturada.', 'info')
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setCarregando(null)
    }
  }

  async function buscarEndereco(e: React.FormEvent) {
    e.preventDefault()
    setCarregando('endereco')
    try {
      const p = await geocodificarEndereco(endereco)
      atualizarUsuario({ localizacao: p })
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setCarregando(null)
    }
  }

  const proxima = db.agendamentos
    .filter((a) => a.clienteEmail === u.email && a.status === 'Confirmado' && new Date(a.inicio).getTime() > Date.now())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]

  return (
    <Page className="pt-4">
      {/* Saudação (Welcome Card do Glide) */}
      <section className="relative overflow-hidden rounded-[22px] bg-brand px-6 pb-6 pt-6 text-white shadow-[0_20px_50px_-20px_rgba(29,111,224,0.6)]">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">Olá, {primeiroNome(u.nome)}</h1>
        <p className="mt-1 text-[13.5px] font-semibold uppercase tracking-[0.08em] text-white/85">Seu estilo começa aqui</p>
        <p className="mt-3 text-[15.5px] leading-6 text-white/90">
          Encontre seu próximo corte em Manaus. Escolha a barbearia e reserve seu horário.
        </p>
        {proxima && (
          <p className="mt-3 rounded-xl bg-white/12 px-3 py-2 text-[14px] font-medium">
            Próximo: {db.servicos.find((s) => s.id === proxima.servicoId)?.nome} em{' '}
            {new Date(proxima.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às{' '}
            {new Date(proxima.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        <Button variant="white" className="mt-5" onClick={() => nav('/agendamentos')}>
          Minha agenda
        </Button>
      </section>

      {/* Localização */}
      <section className="mt-6 rounded-[20px] border border-line/70 bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className={cx('grid h-10 w-10 place-items-center rounded-xl transition-colors', ref?.origem === 'gps' ? 'bg-brand text-white' : 'bg-surface2 text-muted')}>
            {ref?.origem === 'gps' ? <ILocate size={20} /> : <ILocateOff size={20} />}
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-medium">Usar minha localização</div>
            {carregando === 'gps' && <div className="text-[13px] text-muted">Obtendo posição…</div>}
            {ref && carregando !== 'gps' && <div className="truncate text-[13px] text-muted">{ref.rotulo}</div>}
            {!ref && carregando !== 'gps' && semGps && <div className="text-[13px] leading-[18px] text-faint">Indisponível aqui. Use o bairro ou o endereço abaixo.</div>}
          </div>
          <Switch label="Usar minha localização" checked={ref?.origem === 'gps'} disabled={carregando === 'gps'} onChange={ligarGps} />
        </div>

        <form onSubmit={buscarEndereco} className="mt-5">
          <label htmlFor="end" className="text-[15px] font-semibold">
            Buscar por endereço
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="end"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número e bairro em Manaus"
              className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface2 px-3.5 text-[16px] placeholder:text-faint focus:border-brand focus:outline-none"
            />
            <button disabled={!endereco.trim() || carregando === 'endereco'} aria-label="Buscar endereço" className="press grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-white disabled:opacity-40">
              {carregando === 'endereco' ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ISearch size={20} />}
            </button>
          </div>
        </form>

        <div className="mt-4">
          <label htmlFor="bairro" className="text-[15px] font-semibold">
            Ou escolha seu bairro
          </label>
          <select
            id="bairro"
            value={ref?.origem === 'bairro' ? ref.rotulo.replace('Bairro ', '') : ''}
            onChange={(e) => {
              const p = pontoDoBairro(e.target.value)
              if (p) {
                atualizarUsuario({ localizacao: p })
                setEndereco('')
              }
            }}
            className="mt-2 h-12 w-full appearance-none rounded-xl border border-line bg-surface2 px-3.5 text-[16px] focus:border-brand focus:outline-none"
          >
            <option value="">Selecione o bairro</option>
            {Object.keys(BAIRROS).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5">
          <div className="text-[15px] font-semibold">Distância das barbearias</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {OPCOES_DISTANCIA.map((o) => (
              <button
                key={o.limiteKm}
                onClick={() => atualizarUsuario({ raioBuscaKm: o.limiteKm })}
                className={cx(
                  'press h-9 rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-150',
                  raio === o.limiteKm ? 'border-brand bg-brand/15 text-brand-ink' : 'border-line bg-surface2 text-muted hover:text-ink',
                )}
              >
                {o.nome}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Note>
            Ligue a chave para usar sua localização e desligue para voltar ao catálogo completo. A distância é em linha reta. Não encontrou opções? Amplie o raio ou escolha <b>Sem limite</b>.
          </Note>
        </div>
        {ref && (
          <Button
            variant="soft"
            size="md"
            className="mt-3"
            onClick={() => {
              atualizarUsuario({ localizacao: undefined })
              setEndereco('')
            }}
          >
            Ver catálogo completo
          </Button>
        )}
      </section>

      {/* Catálogo */}
      <h2 className="mb-3 mt-8 text-[24px] font-bold tracking-tight">Explore Manaus</h2>
      <SearchInput value={busca} onChange={setBusca} placeholder="Procurar barbearia ou bairro" />
      {ref && (
        <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-muted">
          <IPin size={15} /> {lista.length} {lista.length === 1 ? 'barbearia' : 'barbearias'} {raio === 0 ? 'no catálogo' : `em até ${raio} km`}, da mais próxima para a mais distante
        </p>
      )}
      <Link to="/mapa" className="press mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface2 px-3.5 text-[14px] font-medium text-brand-ink">
        <IMap size={17} /> Ver no mapa
      </Link>
      {lista.length ? (
        <div className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-6">
          {lista.map(({ b, dist }, i) => (
            <CardBarbearia key={b.id} b={b} dist={dist} i={i} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-line p-6 text-center text-[15px] text-muted">
          Nenhuma barbearia {ref ? `em até ${raio} km` : 'encontrada'}.{' '}
          {ref && (
            <button onClick={() => atualizarUsuario({ raioBuscaKm: 0 })} className="font-semibold text-brand-ink">
              Mostrar todas
            </button>
          )}
        </div>
      )}
    </Page>
  )
}

export function CardBarbearia({ b, dist, i = 0 }: { b: Barbearia; dist?: number; i?: number }) {
  const { db } = useApp()
  const nota = notaDaBarbearia(db, b.id)
  return (
    <Link to={`/barbearia/${b.id}`} className="card-press group block animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line/60">
        <Capa b={b} className="transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
        {dist !== undefined && (
          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur">{km(dist)}</span>
        )}
      </div>
      <div className="mt-2.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink">{b.cidade}, AM</div>
      <div className="mt-0.5 text-[15.5px] font-semibold leading-5">{b.nome}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-muted">
        {b.bairro}
        {nota && (
          <span className="flex items-center gap-0.5 text-[13px] font-semibold text-ink">
            <IStar size={13} filled className="text-amber-400" />
            {nota.media.toFixed(1).replace('.', ',')}
          </span>
        )}
      </div>
    </Link>
  )
}
