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

/** Captura pontual autorizada (sem rastreamento contínuo). */
export function capturarGps(): Promise<PontoBusca> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Seu dispositivo não oferece localização.'))
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
              ? 'Permissão de localização negada. Libere nas configurações ou busque por endereço.'
              : 'Não foi possível obter sua localização agora. Tente de novo ou busque por endereço.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    )
  })
}

// Centros aproximados de bairros de Manaus, usados quando a geocodificação online falha.
const BAIRROS: Record<string, [number, number]> = {
  adrianopolis: [-3.1004, -60.0127],
  'nossa senhora das gracas': [-3.1046, -60.0225],
  vieiralves: [-3.1035, -60.0215],
  centro: [-3.1316, -60.0233],
  compensa: [-3.1082, -60.0567],
  'santa etelvina': [-2.9942, -60.0153],
  'tancredo neves': [-3.0564, -59.9662],
  'parque 10': [-3.0835, -60.0155],
  'parque dez': [-3.0835, -60.0155],
  aleixo: [-3.0907, -59.9996],
  'ponta negra': [-3.0631, -60.0985],
  'cidade nova': [-3.0349, -59.9925],
  chapada: [-3.0973, -60.0275],
  'dom pedro': [-3.0858, -60.0428],
  flores: [-3.0703, -60.0145],
  'sao jose': [-3.0832, -59.9506],
  japiim: [-3.1158, -59.9877],
  petropolis: [-3.1102, -59.9969],
  'distrito industrial': [-3.1286, -59.9632],
  'cachoeirinha': [-3.1205, -60.0108],
  'planalto': [-3.0715, -60.0475],
  'alvorada': [-3.0773, -60.0405],
  'coroado': [-3.0898, -59.9787],
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Geocodifica um endereço em Manaus (Nominatim/OSM), com fallback por bairro. */
export async function geocodificarEndereco(texto: string): Promise<PontoBusca> {
  const consulta = texto.trim()
  if (!consulta) throw new Error('Informe rua, número e bairro.')
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta + ', Manaus, AM')}`
    const r = await fetch(url, { headers: { Accept: 'application/json' } })
    if (r.ok) {
      const j = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>
      if (j[0]) return { lat: +j[0].lat, lng: +j[0].lon, origem: 'endereco', rotulo: consulta }
    }
  } catch {
    /* offline: tenta bairros conhecidos */
  }
  const n = normalizar(consulta)
  const hit = Object.entries(BAIRROS).find(([b]) => n.includes(b))
  if (hit) return { lat: hit[1][0], lng: hit[1][1], origem: 'endereco', rotulo: consulta }
  throw new Error('Endereço não encontrado em Manaus. Inclua o bairro, por exemplo: "Rua X, 100, Adrianópolis".')
}
