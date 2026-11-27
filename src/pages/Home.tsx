import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Capa, Note, SeloParceira, Sheet, Switch, cx } from '../components/ui'
import { ICalendar, IChevron, ILocate, ILocateOff, IPin, ISearch, IStar, IX } from '../components/Icons'
import { OPCOES_DISTANCIA } from '../data/seed'
import { barbeariaPermitida, barbeariaVisivel, notaDaBarbearia, parceriaVigente, raioAplicado } from '../domain/rules'
import { BAIRROS, capturarGps, distanciaKm, geocodificarEndereco, gpsIndisponivel, pontoDoBairro } from '../lib/geo'
import { km } from '../lib/format'
import type { Barbearia, Parceria } from '../domain/types'

/*
 * Início = mapa + pesquisa numa tela só.
 * O mapa ocupa a tela; em cima ficam a busca, a localização e o raio; embaixo, uma gaveta
 * com a lista (parceiras em destaque e as barbearias da mais próxima para a mais distante).
 * A busca filtra a lista e os pinos ao mesmo tempo.
 */

// Centro de Manaus, usado enquanto não há ponto de busca.
const MANAUS: L.LatLngTuple = [-3.1019, -60.025]

// Mapa base do OpenStreetMap (sem chave de API). O tema escuro vem de um filtro CSS em .bh-tiles (index.css).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUICAO = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Pino com tesoura, na cor da marca do app. A identidade de cada barbearia aparece na lista.
const TESOURA =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>'
const icones = new Map<string, L.DivIcon>()
/** dx desloca o pino na tela, para barbearias no mesmo endereço (ex.: shopping) não ficarem uma sobre a outra. */
function iconePino(ativo: boolean, dx: number, parceira: boolean) {
  const k = `${ativo}:${dx}:${parceira}`
  if (!icones.has(k))
    icones.set(
      k,
      L.divIcon({
        className: '',
        iconSize: [44, 52],
        iconAnchor: [22 - dx, 50],
        html: `<div class="bh-pin${ativo ? ' bh-pin--ativo' : ''}${parceira ? ' bh-pin--parceira' : ''}"><span>${TESOURA}</span></div>`,
      }),
    )
  return icones.get(k)!
}

/** Deslocamento horizontal (px) de cada pino: 0, +30, -30, +60… dentro de cada grupo de mesmo endereço. */
function deslocamentos(itens: { b: Barbearia }[]) {
  const grupos = new Map<string, number>()
  return itens.map(({ b }) => {
    const chave = `${b.lat.toFixed(4)},${b.lng.toFixed(4)}`
    const n = grupos.get(chave) ?? 0
    grupos.set(chave, n + 1)
    return n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 30
  })
}

const iconeUsuario = L.divIcon({ className: '', iconSize: [22, 22], iconAnchor: [11, 11], html: '<div class="bh-eu"></div>' })

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Alturas da gaveta da lista: recolhida (o mapa domina) ou aberta (a lista domina).
const GAVETA_BAIXA = 248
const ESPACO_TOPO = 112 // a gaveta aberta para abaixo da busca e do raio

type Item = { b: Barbearia; dist?: number; parceria?: Parceria }

export default function Home() {
  const { db, atualizarUsuario, toast } = useApp()
  const u = useUsuario()
  const ref = u.localizacao
  const raio = raioAplicado(u)

  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(false)
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [painelLocal, setPainelLocal] = useState(false)
  const [carregando, setCarregando] = useState<'gps' | 'endereco' | null>(null)

  const el = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.LayerGroup | null>(null)
  const lista = useRef<HTMLDivElement>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const [alturaTela, setAlturaTela] = useState(600)

  // Barbearias com assinatura em dia (RN08), dentro do raio, da mais próxima para a mais distante.
  const noRaio = useMemo<Item[]>(() => {
    let itens: Item[] = db.barbearias
      // Conta de barbeiro só enxerga a própria barbearia.
      .filter((b) => b.cidade === 'Manaus' && barbeariaVisivel(b) && barbeariaPermitida(u, b.id))
      .map((b) => ({ b, dist: ref ? distanciaKm(ref, b) : undefined, parceria: parceriaVigente(db, b.id) }))
    if (ref) itens = itens.filter((x) => raio === 0 || (x.dist ?? 0) <= raio).sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0))
    return itens
  }, [db, ref, raio, u])

  // A pesquisa filtra a lista e os pinos do mapa.
  const q = normalizar(busca.trim())
  const visiveis = useMemo(() => (q ? noRaio.filter(({ b }) => normalizar(`${b.nome} ${b.bairro}`).includes(q)) : noRaio), [noRaio, q])
  // Parceiras BarberHUB: destaque próprio no topo da lista (RN09); a lista segue a ordem por distância.
  const parceiras = useMemo(() => visiveis.filter((x) => x.parceria), [visiveis])

  const proxima = db.agendamentos
    .filter((a) => a.clienteEmail === u.email && a.status === 'Confirmado' && new Date(a.inicio).getTime() > Date.now())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]

  // Altura disponível, para a gaveta aberta e o enquadramento do mapa.
  useEffect(() => {
    const r = raiz.current
    if (!r) return
    const ro = new ResizeObserver(() => setAlturaTela(r.clientHeight))
    ro.observe(r)
    return () => ro.disconnect()
  }, [])
  const alturaGaveta = aberta ? Math.max(GAVETA_BAIXA, alturaTela - ESPACO_TOPO) : Math.min(GAVETA_BAIXA, alturaTela - ESPACO_TOPO)

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!el.current || mapa.current) return
    const m = L.map(el.current, { center: MANAUS, zoom: 12, zoomControl: false, attributionControl: true })
    L.tileLayer(TILES, { attribution: ATRIBUICAO, maxZoom: 19, className: 'bh-tiles' }).addTo(m)
    m.attributionControl.setPrefix(false)
    m.attributionControl.setPosition('topright')
    camada.current = L.layerGroup().addTo(m)
    mapa.current = m
    // Tocar no mapa vazio recolhe a gaveta.
    m.on('click', () => {
      setSelecionada(null)
      setAberta(false)
    })
    return () => {
      m.remove()
      mapa.current = null
    }
  }, [])

  // Redesenha pinos, ponto do usuário e círculo do raio.
  useEffect(() => {
    const m = mapa.current
    const g = camada.current
    if (!m || !g) return
    g.clearLayers()
    if (ref) {
      if (raio > 0)
        L.circle([ref.lat, ref.lng], {
          radius: raio * 1000,
          color: '#1d6fe0',
          weight: 1.5,
          fillColor: '#1d6fe0',
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(g)
      L.marker([ref.lat, ref.lng], { icon: iconeUsuario, interactive: false, zIndexOffset: 1000 }).addTo(g)
    }
    const dx = deslocamentos(visiveis)
    visiveis.forEach(({ b, parceria }, i) => {
      const ativo = b.id === selecionada
      const nome = parceria ? `${b.nome} (parceira)` : b.nome
      L.marker([b.lat, b.lng], {
        icon: iconePino(ativo, dx[i], !!parceria),
        title: nome,
        alt: nome,
        zIndexOffset: ativo ? 500 : parceria ? 100 : 0,
        keyboard: true,
      })
        .on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          selecionar(b.id, false)
        })
        .addTo(g)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis, ref, raio, selecionada])

  // Reenquadra quando o ponto de busca, o raio ou o resultado da pesquisa mudam (não ao tocar num pino).
  const chaveResultado = q ? visiveis.map((x) => x.b.id).join(',') : ''
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const t = setTimeout(() => {
      let limites: L.LatLngBounds | null = null
      if (q && visiveis.length) limites = L.latLngBounds(visiveis.map(({ b }) => [b.lat, b.lng] as L.LatLngTuple))
      else if (ref && raio > 0) limites = L.latLng(ref.lat, ref.lng).toBounds(raio * 2000)
      else if (visiveis.length) {
        limites = L.latLngBounds(visiveis.map(({ b }) => [b.lat, b.lng] as L.LatLngTuple))
        if (ref) limites.extend([ref.lat, ref.lng])
      }
      const opcoes = { paddingTopLeft: [24, ESPACO_TOPO] as L.PointTuple, paddingBottomRight: [24, GAVETA_BAIXA + 24] as L.PointTuple, maxZoom: 16, duration: 0.6 }
      if (limites) m.flyToBounds(limites, opcoes)
      else if (ref) m.flyTo([ref.lat, ref.lng], 15, { duration: 0.6 })
    }, q ? 350 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.lat, ref?.lng, raio, chaveResultado])

  // Se a barbearia selecionada saiu do resultado, desfaz a seleção.
  useEffect(() => {
    if (selecionada && !visiveis.some(({ b }) => b.id === selecionada)) setSelecionada(null)
  }, [visiveis, selecionada])

  /** Pelo pino: destaca a barbearia na lista. Pela lista: centraliza o mapa nela e recolhe a gaveta. */
  function selecionar(id: string, peloLista: boolean) {
    setSelecionada(id)
    if (peloLista) {
      setAberta(false)
      const b = visiveis.find((x) => x.b.id === id)?.b
      const m = mapa.current
      if (b && m) {
        // Centraliza no espaço visível acima da gaveta recolhida.
        const p = m.project([b.lat, b.lng], Math.max(m.getZoom(), 15)).add([0, GAVETA_BAIXA / 2 - ESPACO_TOPO / 2])
        m.flyTo(m.unproject(p, Math.max(m.getZoom(), 15)), Math.max(m.getZoom(), 15), { duration: 0.5 })
      }
    }
    requestAnimationFrame(() => {
      const alvo = lista.current?.querySelector(`[data-id="${CSS.escape(id)}"]`) as HTMLElement | null
      if (alvo && lista.current) lista.current.scrollTo({ top: alvo.offsetTop - 8, behavior: 'smooth' })
    })
  }

  async function usarGps() {
    setCarregando('gps')
    try {
      const p = await capturarGps()
      await atualizarUsuario({ localizacao: p })
      if (ref?.lat === p.lat && ref?.lng === p.lng) mapa.current?.flyTo([p.lat, p.lng], 15, { duration: 0.6 })
      setPainelLocal(false)
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setCarregando(null)
    }
  }

  /** Usa um texto como endereço (Nominatim, com bairros conhecidos como reserva). */
  async function buscarEndereco(texto: string) {
    setCarregando('endereco')
    try {
      const p = await geocodificarEndereco(texto)
      await atualizarUsuario({ localizacao: p })
      setBusca('')
      setPainelLocal(false)
      toast(`Mostrando barbearias perto de ${p.rotulo}.`, 'info')
    } catch (err) {
      toast((err as Error).message, 'erro')
    } finally {
      setCarregando(null)
    }
  }

  // Enter na pesquisa sem nenhuma barbearia com esse nome: tenta como endereço.
  function enviarBusca(e: React.FormEvent) {
    e.preventDefault()
    ;(document.activeElement as HTMLElement | null)?.blur()
    if (busca.trim() && !visiveis.length) buscarEndereco(busca)
    else setAberta(true)
  }

  // Arrastar a alça da gaveta para cima ou para baixo (ou tocar nela) abre e recolhe.
  const arrasto = useRef<{ y: number } | null>(null)
  const onDown = (e: React.PointerEvent) => {
    arrasto.current = { y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onUp = (e: React.PointerEvent) => {
    if (!arrasto.current) return
    const dy = e.clientY - arrasto.current.y
    arrasto.current = null
    if (Math.abs(dy) < 8) setAberta((a) => !a)
    else setAberta(dy < 0)
  }

  const resumo = q
    ? visiveis.length
      ? `${visiveis.length} ${visiveis.length === 1 ? 'resultado' : 'resultados'} para "${busca.trim()}"`
      : 'Nenhum resultado'
    : ref
      ? `${visiveis.length} ${visiveis.length === 1 ? 'barbearia' : 'barbearias'} ${raio === 0 ? 'no catálogo' : `em até ${raio} km`}`
      : `${visiveis.length} barbearias em Manaus`

  return (
    <>
    <div
      ref={raiz}
      className="fixed inset-x-0 z-0 overflow-hidden"
      style={{ top: 'calc(56px + env(safe-area-inset-top))', bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
    >
      <div ref={el} className="bh-mapa absolute inset-0" aria-label="Mapa de barbearias" role="region" />

      {/* Pesquisa, localização e raio */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-3 pt-3">
        <form onSubmit={enviarBusca} className="pointer-events-auto mx-auto flex max-w-[520px] gap-2" role="search">
          <label className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-bg/90 px-3.5 shadow-xl shadow-black/50 backdrop-blur-xl focus-within:border-brand">
            <ISearch size={19} className="shrink-0 text-faint" />
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                if (e.target.value.trim()) setAberta(true)
              }}
              enterKeyHint="search"
              placeholder="Barbearia, bairro ou endereço"
              aria-label="Pesquisar barbearia, bairro ou endereço"
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-faint focus:outline-none"
            />
            {busca && (
              <button type="button" aria-label="Limpar pesquisa" onClick={() => setBusca('')} className="press -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted">
                <IX size={17} />
              </button>
            )}
          </label>
          <button
            type="button"
            aria-label={ref?.origem === 'gps' ? 'Centralizar na minha localização' : 'Usar minha localização'}
            onClick={usarGps}
            disabled={carregando === 'gps'}
            className={cx(
              'press grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-line bg-bg/90 shadow-xl shadow-black/50 backdrop-blur-xl',
              ref?.origem === 'gps' ? 'text-brand-ink' : 'text-muted',
            )}
          >
            {carregando === 'gps' ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" /> : <ILocate size={22} />}
          </button>
        </form>

        <div className="pointer-events-auto mx-auto mt-2 flex max-w-[520px] select-none gap-2">
          <button
            onClick={() => setPainelLocal(true)}
            className={cx(
              'press flex h-9 min-w-0 items-center gap-1.5 rounded-full border border-line bg-bg/85 px-3 text-[14px] font-medium text-ink shadow-lg shadow-black/40 backdrop-blur-xl',
            )}
          >
            <IPin size={15} className={ref ? 'text-brand-ink' : 'text-faint'} />
            <span className="truncate">{ref ? ref.rotulo.replace(/^Bairro /, '') : 'Definir localização'}</span>
          </button>
          {/* Raio: um seletor compacto no lugar da fileira de chips, que não cabia e não rolava com o mouse. */}
          {ref && (
            <label className="relative flex h-9 shrink-0 items-center rounded-full border border-brand bg-brand text-[14px] font-medium text-white shadow-lg shadow-black/40">
              <span className="sr-only">Distância das barbearias</span>
              <select
                value={raio}
                onChange={(e) => atualizarUsuario({ raioBuscaKm: Number(e.target.value) })}
                className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-3.5 pr-8 focus:outline-none"
              >
                {OPCOES_DISTANCIA.map((o) => (
                  <option key={o.limiteKm} value={o.limiteKm} className="bg-surface text-ink">
                    {o.nome}
                  </option>
                ))}
              </select>
              <IChevron size={15} className="pointer-events-none absolute right-2.5 rotate-90" />
            </label>
          )}
        </div>
      </div>

      {/* Gaveta com a lista */}
      <section
        aria-label="Lista de barbearias"
        className="absolute inset-x-0 bottom-0 z-[600] mx-auto flex max-w-[520px] flex-col rounded-t-[22px] border-t border-line bg-surface/[0.97] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ height: alturaGaveta }}
      >
        <div
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (arrasto.current = null)}
          role="button"
          tabIndex={0}
          aria-expanded={aberta}
          aria-label={aberta ? 'Recolher lista' : 'Abrir lista'}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setAberta((a) => !a))}
          className="shrink-0 cursor-grab touch-none px-4 pb-2 pt-2.5 active:cursor-grabbing"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
          <div className="mt-2.5 flex items-baseline justify-between gap-3">
            <h1 className="truncate text-[17px] font-semibold tracking-tight">{resumo}</h1>
            {ref && !q && visiveis.length > 1 && <span className="shrink-0 text-[12.5px] text-faint">mais perto primeiro</span>}
          </div>
        </div>

        <div ref={lista} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {/* Sem ponto de busca: convite para usar a localização */}
          {!ref && !q && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/10 p-3">
              <ILocateOff size={22} className="shrink-0 text-brand-ink" />
              <p className="min-w-0 flex-1 text-[13.5px] leading-[18px] text-muted">Use sua localização, um endereço ou o bairro para ver as mais próximas primeiro.</p>
              <Button size="sm" className="shrink-0" onClick={() => setPainelLocal(true)}>
                Definir
              </Button>
            </div>
          )}

          {proxima && !q && (
            <Link to={`/agendamento/${proxima.id}`} className="row-press mb-3 flex items-center gap-3 rounded-2xl border border-line/70 bg-surface2/60 p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
                <ICalendar size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold uppercase tracking-wide text-brand-ink">Próximo agendamento</span>
                <span className="block truncate text-[14.5px] font-medium">
                  {db.servicos.find((s) => s.id === proxima.servicoId)?.nome} ·{' '}
                  {new Date(proxima.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às{' '}
                  {new Date(proxima.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              <IChevron size={18} className="shrink-0 text-faint" />
            </Link>
          )}

          {/* Parceiras BarberHUB: preço especial agendando pelo app */}
          {parceiras.length > 0 && (
            <div className="mb-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-bold tracking-tight">Parceiras BarberHUB</h2>
                <span className="text-[12.5px] font-medium text-amber-300">Preço especial pelo app</span>
              </div>
              <div className="no-scrollbar -mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
                {parceiras.map(({ b, parceria, dist }) => (
                  <Link
                    key={b.id}
                    to={`/barbearia/${b.id}`}
                    className="card-press flex w-[240px] shrink-0 snap-start items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.07] p-2"
                  >
                    <span className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-line/60">
                      <Capa b={b} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <SeloParceira />
                      <span className="mt-1 block truncate text-[14.5px] font-semibold leading-5">{b.nome}</span>
                      <span className="block truncate text-[13px] text-muted">
                        <b className="font-semibold text-amber-300">{parceria!.descontoPct}% off</b>
                        {dist !== undefined ? ` · ${km(dist)}` : ` · ${b.bairro}`}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {visiveis.length ? (
            <ul className="-mx-2 space-y-1">
              {visiveis.map((item) => (
                <LinhaBarbearia key={item.b.id} item={item} ativa={item.b.id === selecionada} onMapa={() => selecionar(item.b.id, true)} />
              ))}
            </ul>
          ) : q ? (
            <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[14.5px] text-muted">
              Nenhuma barbearia com "{busca.trim()}"{ref && raio > 0 ? ` em até ${raio} km` : ''}.
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="soft" disabled={carregando === 'endereco'} onClick={() => buscarEndereco(busca)}>
                  {carregando === 'endereco' ? 'Procurando…' : 'Buscar como endereço'}
                </Button>
                {ref && raio > 0 && (
                  <Button size="sm" variant="soft" onClick={() => atualizarUsuario({ raioBuscaKm: 0 })}>
                    Sem limite de distância
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[14.5px] text-muted">
              Nenhuma barbearia {ref ? `em até ${raio} km` : 'encontrada'}.{' '}
              {ref && (
                <button onClick={() => atualizarUsuario({ raioBuscaKm: 0 })} className="font-semibold text-brand-ink">
                  Mostrar todas
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>

    {/* Fora do contêiner do mapa (z-0) para o painel ficar acima do cabeçalho e da tab bar. */}
    <PainelLocalizacao
        open={painelLocal}
        onClose={() => setPainelLocal(false)}
        carregando={carregando}
        onGps={usarGps}
        onEndereco={buscarEndereco}
      />
    </>
  )
}

function LinhaBarbearia({ item: { b, dist, parceria }, ativa, onMapa }: { item: Item; ativa: boolean; onMapa: () => void }) {
  const { db } = useApp()
  const nota = notaDaBarbearia(db, b.id)
  return (
    <li data-id={b.id} className={cx('flex items-center gap-1 rounded-2xl border transition-colors duration-150', ativa ? 'border-brand bg-brand/10' : 'border-transparent')}>
      <Link to={`/barbearia/${b.id}`} className="row-press flex min-w-0 flex-1 items-center gap-3 p-2">
        <span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl border border-line/60">
          <Capa b={b} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-brand-ink">
            <span className="truncate">{b.bairro}</span>
            {parceria && <SeloParceira pct={parceria.descontoPct} className="shrink-0" />}
          </span>
          <span className="mt-0.5 block truncate text-[15.5px] font-semibold leading-5">{b.nome}</span>
          <span className="mt-0.5 flex items-center gap-2 text-[13.5px] text-muted">
            {dist !== undefined && <span>{km(dist)}</span>}
            {nota && (
              <span className="flex items-center gap-0.5 font-semibold text-ink">
                <IStar size={13} filled className="text-amber-400" />
                {nota.media.toFixed(1).replace('.', ',')}
              </span>
            )}
          </span>
        </span>
      </Link>
      <button
        onClick={onMapa}
        aria-label={`Mostrar ${b.nome} no mapa`}
        className={cx('press mr-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-full', ativa ? 'bg-brand text-white' : 'bg-surface2 text-muted')}
      >
        <IPin size={18} />
      </button>
    </li>
  )
}

/** Painel para definir o ponto de busca: GPS, endereço ou bairro (o raio fica no seletor sobre o mapa). */
function PainelLocalizacao({
  open,
  onClose,
  carregando,
  onGps,
  onEndereco,
}: {
  open: boolean
  onClose: () => void
  carregando: 'gps' | 'endereco' | null
  onGps: () => void
  onEndereco: (texto: string) => void
}) {
  const { atualizarUsuario } = useApp()
  const u = useUsuario()
  const ref = u.localizacao
  const semGps = useMemo(gpsIndisponivel, [])
  const [endereco, setEndereco] = useState(ref?.origem === 'endereco' ? ref.rotulo : '')

  return (
    <Sheet open={open} onClose={onClose} title="Sua localização">
      <div className="flex items-center gap-3">
        <span className={cx('grid h-10 w-10 place-items-center rounded-xl transition-colors', ref?.origem === 'gps' ? 'bg-brand text-white' : 'bg-surface2 text-muted')}>
          {ref?.origem === 'gps' ? <ILocate size={20} /> : <ILocateOff size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-medium">Usar minha localização</div>
          {carregando === 'gps' && <div className="text-[13px] text-muted">Obtendo posição…</div>}
          {ref && carregando !== 'gps' && <div className="truncate text-[13px] text-muted">{ref.rotulo}</div>}
          {!ref && carregando !== 'gps' && semGps && <div className="text-[13px] leading-[18px] text-faint">Indisponível aqui. Use o bairro ou o endereço abaixo.</div>}
        </div>
        <Switch
          label="Usar minha localização"
          checked={ref?.origem === 'gps'}
          disabled={carregando === 'gps'}
          onChange={(on) => (on ? onGps() : atualizarUsuario({ localizacao: undefined }))}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onEndereco(endereco)
        }}
        className="mt-5"
      >
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
              onClose()
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
        <Note>A distância é em linha reta. Escolha o raio no seletor ao lado da localização, sobre o mapa; sem localização, você vê o catálogo completo de Manaus.</Note>
      </div>
      {ref && (
        <Button
          variant="soft"
          size="md"
          className="mt-3"
          onClick={() => {
            atualizarUsuario({ localizacao: undefined })
            setEndereco('')
            onClose()
          }}
        >
          Ver catálogo completo
        </Button>
      )}
    </Sheet>
  )
}

/** Cartão de barbearia em grade (usado em Favoritos). */
export function CardBarbearia({ b, dist, i = 0 }: { b: Barbearia; dist?: number; i?: number }) {
  const { db } = useApp()
  const nota = notaDaBarbearia(db, b.id)
  const parceria = parceriaVigente(db, b.id)
  return (
    <Link to={`/barbearia/${b.id}`} className="card-press group block animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line/60">
        <Capa b={b} className="transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
        {parceria && <SeloParceira pct={parceria.descontoPct} className="absolute left-2 top-2 shadow-md shadow-black/40" />}
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
