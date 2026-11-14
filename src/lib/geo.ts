import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { PontoBusca } from '../domain/types'

/** Distância em linha reta (haversine), em km. */
export function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Motivo pelo qual o GPS não pode ser usado neste ambiente, ou null se pode. */
export function gpsIndisponivel(): string | null {
  if (Capacitor.isNativePlatform()) return null
  if (!('geolocation' in navigator)) return 'Este navegador não oferece localização. Escolha seu bairro ou busque por endereço.'
  if (!window.isSecureContext)
    return 'O navegador só libera o GPS em endereços https. Use `npm run dev:https` ou escolha seu bairro.'
  const fp = (document as unknown as { featurePolicy?: { allowsFeature(f: string): boolean } }).featurePolicy
  if (fp && !fp.allowsFeature('geolocation'))
    return 'A localização não está liberada nesta prévia. Escolha seu bairro ou busque por endereço; no app instalado o GPS funciona.'
  return null
}

/** Captura pontual autorizada (sem rastreamento contínuo). No app nativo usa o plugin do Capacitor. */
export async function capturarGps(): Promise<PontoBusca> {
  const bloqueio = gpsIndisponivel()
  if (bloqueio) throw new Error(bloqueio)
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await Geolocation.requestPermissions({ permissions: ['location'] })
      if (perm.location === 'denied') throw new Error('negada')
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
      return { lat: p.coords.latitude, lng: p.coords.longitude, origem: 'gps', rotulo: `Minha localização (±${Math.round(p.coords.accuracy)} m)` }
    } catch (e) {
      throw new Error(
        (e as Error).message === 'negada'
          ? 'Permissão de localização negada. Libere em Configurações > Apps > BarberHUB > Permissões.'
          : 'Não foi possível obter sua localização. Verifique se o GPS está ligado e tente de novo.',
      )
    }
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          origem: 'gps',
          rotulo: `Minha localização (±${Math.round(p.coords.accuracy)} m)`,
        }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Permissão de localização negada. Toque no cadeado ao lado do endereço do site, libere Localização e tente de novo, ou escolha seu bairro.'
              : 'Não foi possível obter sua localização agora. Verifique se o GPS está ligado ou escolha seu bairro.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

// Centros aproximados de bairros de Manaus, usados quando a geocodificação online falha.
export const BAIRROS: Record<string, [number, number]> = {
  'Adrianópolis': [-3.1004, -60.0127],
  'Aleixo': [-3.0907, -59.9996],
  'Alvorada': [-3.0773, -60.0405],
  'Cachoeirinha': [-3.1205, -60.0108],
  'Centro': [-3.1316, -60.0233],
  'Chapada': [-3.0973, -60.0275],
  'Cidade de Deus': [-3.0212, -59.9558],
  'Cidade Nova': [-3.0349, -59.9925],
  'Compensa': [-3.1082, -60.0567],
  'Coroado': [-3.0898, -59.9787],
  'Da Paz': [-3.0624, -60.0452],
  'Distrito Industrial': [-3.1286, -59.9632],
  'Dom Pedro': [-3.0858, -60.0428],
  'Educandos': [-3.1395, -60.0128],
  'Flores': [-3.0703, -60.0145],
  'Gilberto Mestrinho': [-3.0846, -59.9373],
  'Japiim': [-3.1158, -59.9877],
  'Jorge Teixeira': [-3.0465, -59.9306],
  'Lago Azul': [-2.9933, -60.0469],
  'Monte das Oliveiras': [-3.0112, -60.0039],
  'Nossa Senhora das Graças': [-3.1046, -60.0225],
  'Novo Aleixo': [-3.0437, -59.9831],
  'Parque 10 de Novembro': [-3.0835, -60.0155],
  'Petrópolis': [-3.1102, -59.9969],
  'Planalto': [-3.0715, -60.0475],
  'Ponta Negra': [-3.0631, -60.0985],
  'Praça 14 de Janeiro': [-3.1222, -60.0154],
  'Redenção': [-3.0632, -60.0617],
  'Santa Etelvina': [-2.9942, -60.0153],
  'São Jorge': [-3.1066, -60.0395],
  'São José Operário': [-3.0832, -59.9506],
  'Tancredo Neves': [-3.0564, -59.9662],
  'Tarumã': [-3.0187, -60.0563],
  'Vieiralves': [-3.1035, -60.0215],
  'Zumbi dos Palmares': [-3.0668, -59.9455],
}

export function pontoDoBairro(nome: string): PontoBusca | null {
  const c = BAIRROS[nome]
  return c ? { lat: c[0], lng: c[1], origem: 'bairro', rotulo: `Bairro ${nome}` } : null
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Geocodifica um endereço em Manaus (Nominatim/OSM), com fallback por bairro. */
export async function geocodificarEndereco(texto: string): Promise<PontoBusca> {
  const consulta = texto.trim()
  if (!consulta) throw new Error('Informe rua, número e bairro.')
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta + ', Manaus, AM')}`
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
    clearTimeout(t)
    if (r.ok) {
      const j = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>
      if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon, origem: 'endereco', rotulo: consulta }
    }
  } catch {
    /* offline: tenta bairros conhecidos */
  }
  const n = normalizar(consulta).replace(/\bparque (dez|10)\b/, 'parque 10 de novembro')
  const hit = Object.entries(BAIRROS)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([b]) => n.includes(normalizar(b)))
  if (hit) return { lat: hit[1][0], lng: hit[1][1], origem: 'endereco', rotulo: consulta }
  throw new Error('Não encontrei esse endereço. Inclua o nome do bairro (ex.: "Rua X, 100, Adrianópolis") ou escolha o bairro na lista.')
}
