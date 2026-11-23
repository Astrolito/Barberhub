import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp, useUsuario } from "../state/AppContext";
import { Button, Capa, cx } from "../components/ui";
import { IChevron, ILocate, IPin } from "../components/Icons";
import { OPCOES_DISTANCIA } from "../data/seed";
import { raioAplicado } from "../domain/rules";
import { capturarGps, distanciaKm, gpsIndisponivel } from "../lib/geo";
import { km } from "../lib/format";
import type { Barbearia } from "../domain/types";

// Centro de Manaus, usado enquanto não há ponto de busca.
const MANAUS: L.LatLngTuple = [-3.1019, -60.025];

// Mapa base escuro (OpenStreetMap via CARTO): combina com o tema do app e não exige chave de API.
const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATRIBUICAO =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// Pino com tesoura, na cor da marca do app. A identidade de cada barbearia aparece nos cartões.
const TESOURA =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>';
const icones = new Map<string, L.DivIcon>();
/** dx desloca o pino na tela, para barbearias no mesmo endereço (ex.: shopping) não ficarem uma sobre a outra. */
function iconePino(ativo: boolean, dx: number) {
  const k = `${ativo}:${dx}`;
  if (!icones.has(k))
    icones.set(
      k,
      L.divIcon({
        className: "",
        iconSize: [44, 52],
        iconAnchor: [22 - dx, 50],
        html: `<div class="bh-pin${ativo ? " bh-pin--ativo" : ""}"><span>${TESOURA}</span></div>`,
      }),
    );
  return icones.get(k)!;
}

/** Deslocamento horizontal (px) de cada pino: 0, +30, -30, +60… dentro de cada grupo de mesmo endereço. */
function deslocamentos(itens: { b: Barbearia }[]) {
  const grupos = new Map<string, number>();
  return itens.map(({ b }) => {
    const chave = `${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
    const n = grupos.get(chave) ?? 0;
    grupos.set(chave, n + 1);
    return n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 30;
  });
}

const iconeUsuario = L.divIcon({
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: '<div class="bh-eu"></div>',
});

export default function Mapa() {
  const { db, atualizarUsuario, toast } = useApp();
  const u = useUsuario();
  const nav = useNavigate();
  const ref = u.localizacao;
  const raio = raioAplicado(u);
  const semGps = useMemo(gpsIndisponivel, []);
  const [carregando, setCarregando] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const el = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const camada = useRef<L.LayerGroup | null>(null);

  // Barbearias dentro do raio (ou todas, sem ponto de busca / sem limite), da mais próxima para a mais distante.
  const visiveis = useMemo(() => {
    const itens = db.barbearias
      .filter((b) => b.cidade === "Manaus")
      .map((b) => ({ b, dist: ref ? distanciaKm(ref, b) : undefined }));
    if (!ref) return itens;
    return itens
      .filter((x) => raio === 0 || (x.dist ?? 0) <= raio)
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  }, [db.barbearias, ref, raio]);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!el.current || mapa.current) return;
    const m = L.map(el.current, {
      center: MANAUS,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(TILES, {
      attribution: ATRIBUICAO,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(m);
    m.attributionControl.setPrefix(false);
    camada.current = L.layerGroup().addTo(m);
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
  }, []);

  // Redesenha marcadores, ponto do usuário e círculo do raio.
  useEffect(() => {
    const m = mapa.current;
    const g = camada.current;
    if (!m || !g) return;
    g.clearLayers();

    if (ref) {
      if (raio > 0)
        L.circle([ref.lat, ref.lng], {
          radius: raio * 1000,
          color: "#1d6fe0",
          weight: 1.5,
          fillColor: "#1d6fe0",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(g);
      L.marker([ref.lat, ref.lng], {
        icon: iconeUsuario,
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(g);
    }
    const dx = deslocamentos(visiveis);
    visiveis.forEach(({ b }, i) => {
      const ativo = b.id === selecionada;
      L.marker([b.lat, b.lng], {
        icon: iconePino(ativo, dx[i]),
        title: b.nome,
        alt: b.nome,
        zIndexOffset: ativo ? 500 : 0,
        keyboard: true,
      })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          selecionar(b.id, false);
        })
        .addTo(g);
    });
  }, [visiveis, ref, raio, selecionada]);

  // Reenquadra só quando o ponto de busca ou o raio mudam, não ao selecionar um marcador.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    let limites: L.LatLngBounds | null = null;
    if (ref && raio > 0)
      limites = L.latLng(ref.lat, ref.lng).toBounds(raio * 2000);
    else if (visiveis.length) {
      limites = L.latLngBounds(
        visiveis.map(({ b }) => [b.lat, b.lng] as L.LatLngTuple),
      );
      if (ref) limites.extend([ref.lat, ref.lng]);
    }
    if (limites)
      m.flyToBounds(limites, {
        paddingTopLeft: [24, 96],
        paddingBottomRight: [24, ref ? 150 : 140],
        maxZoom: 16,
        duration: 0.6,
      });
    else if (ref) m.flyTo([ref.lat, ref.lng], 15, { duration: 0.6 });
  }, [ref?.lat, ref?.lng, raio]);

  const lista = useRef<HTMLDivElement>(null);
  /** Seleciona uma barbearia: destaca o pino e mostra o cartão; pelo cartão, centraliza o mapa nela. */
  function selecionar(id: string, centralizar: boolean) {
    setSelecionada(id);
    requestAnimationFrame(() =>
      lista.current
        ?.querySelector(`[data-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        }),
    );
    if (centralizar) {
      const b = visiveis.find((x) => x.b.id === id)?.b;
      if (b)
        mapa.current?.panTo([b.lat, b.lng], { animate: true, duration: 0.4 });
    }
  }

  // Se a barbearia selecionada saiu do raio, desfaz a seleção.
  useEffect(() => {
    if (selecionada && !visiveis.some(({ b }) => b.id === selecionada))
      setSelecionada(null);
  }, [visiveis, selecionada]);

  async function localizar() {
    setCarregando(true);
    try {
      const p = await capturarGps();
      await atualizarUsuario({ localizacao: p });
      if (ref?.lat === p.lat && ref?.lng === p.lng)
        mapa.current?.flyTo([p.lat, p.lng], 15, { duration: 0.6 });
    } catch (e) {
      toast((e as Error).message, "erro");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="fixed inset-x-0 z-0"
      style={{
        top: "calc(56px + env(safe-area-inset-top))",
        bottom: "calc(64px + env(safe-area-inset-bottom))",
      }}
    >
      <div
        ref={el}
        className="bh-mapa absolute inset-0"
        aria-label="Mapa de barbearias"
        role="region"
      />

      {/* Raio de busca */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-3 pt-3">
        <div className="no-scrollbar pointer-events-auto mx-auto flex max-w-[520px] gap-2 overflow-x-auto">
          {OPCOES_DISTANCIA.map((o) => (
            <button
              key={o.limiteKm}
              onClick={() => atualizarUsuario({ raioBuscaKm: o.limiteKm })}
              className={cx(
                "press h-9 shrink-0 rounded-full border px-3.5 text-[14px] font-medium shadow-lg shadow-black/40 backdrop-blur-xl transition-colors duration-150",
                raio === o.limiteKm
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-bg/85 text-muted hover:text-ink",
              )}
            >
              {o.nome}
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 max-w-[520px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bg/85 px-3 py-1.5 text-[13px] text-muted shadow-lg shadow-black/40 backdrop-blur-xl">
            <IPin size={14} />
            {ref
              ? `${visiveis.length} ${visiveis.length === 1 ? "barbearia" : "barbearias"} ${raio === 0 ? "no mapa" : `em até ${raio} km`}`
              : `${visiveis.length} barbearias em Manaus`}
          </span>
        </div>
      </div>

      {/* Botão de localização */}
      {ref && (
        <button
          aria-label="Centralizar na minha localização"
          onClick={localizar}
          disabled={carregando}
          className={cx(
            "press absolute right-3 z-[500] grid h-12 w-12 place-items-center rounded-full border border-line bg-bg/90 shadow-xl shadow-black/50 backdrop-blur-xl transition-[bottom] duration-300 ease-out",
            ref?.origem === "gps" ? "text-brand-ink" : "text-muted",
          )}
          style={{ bottom: ref && visiveis.length ? 150 : 16 }}
        >
          {carregando ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
          ) : (
            <ILocate size={22} />
          )}
        </button>
      )}

      {/* Sem ponto de busca: convite para ligar a localização */}
      {!ref && (
        <div className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-[520px] animate-fade-up rounded-2xl border border-line bg-surface/95 p-4 pr-16 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="text-[15.5px] font-semibold">
            Veja o que está perto de você
          </div>
          <p className="mt-1 text-[13.5px] leading-[19px] text-muted">
            {semGps ??
              "Use sua localização para ver as barbearias dentro do raio escolhido."}
          </p>
          {semGps ? (
            <Button
              variant="soft"
              size="sm"
              className="mt-3"
              onClick={() => nav("/")}
            >
              Escolher bairro no Início
            </Button>
          ) : (
            <Button
              size="sm"
              className="mt-3"
              onClick={localizar}
              disabled={carregando}
            >
              Usar minha localização
            </Button>
          )}
        </div>
      )}

      {/* Com ponto de busca e nada no raio */}
      {ref && !visiveis.length && (
        <div className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-[520px] animate-fade-up rounded-2xl border border-line bg-surface/95 p-4 pr-16 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <div className="text-[15.5px] font-semibold">
            Nenhuma barbearia em até {raio} km
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            Amplie o raio para ver mais opções.
          </p>
          <Button
            variant="soft"
            size="sm"
            className="mt-3"
            onClick={() => atualizarUsuario({ raioBuscaKm: 0 })}
          >
            Mostrar todas
          </Button>
        </div>
      )}

      {/* Barbearias no raio, da mais próxima para a mais distante */}
      {ref && visiveis.length > 0 && (
        <div
          ref={lista}
          className="no-scrollbar absolute inset-x-0 bottom-3 z-[500] flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 animate-fade-up"
        >
          {visiveis.map(({ b, dist }) => {
            const ativo = b.id === selecionada;
            return (
              <div
                key={b.id}
                data-id={b.id}
                className={cx(
                  "flex w-[300px] max-w-[85vw] shrink-0 snap-center items-center gap-3 rounded-2xl border bg-surface/95 p-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl transition-colors duration-150",
                  ativo ? "border-brand" : "border-line",
                )}
              >
                <button
                  onClick={() => selecionar(b.id, true)}
                  aria-label={`Mostrar ${b.nome} no mapa`}
                  className="card-press h-[96px] w-[96px] shrink-0 overflow-hidden rounded-xl border border-line/60"
                >
                  <Capa b={b} />
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => selecionar(b.id, true)}
                    className="block w-full text-left"
                  >
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-brand-ink">
                      {b.bairro}
                    </div>
                    <div className="mt-0.5 truncate text-[15.5px] font-semibold leading-5">
                      {b.nome}
                    </div>
                    {dist !== undefined && (
                      <div className="mt-0.5 text-[13.5px] text-muted">
                        {km(dist)} de você
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => nav(`/barbearia/${b.id}`)}
                    className="press mt-2 inline-flex h-8 items-center gap-0.5 rounded-full bg-brand px-3 text-[13.5px] font-semibold text-white"
                  >
                    Ver barbearia <IChevron size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
