const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const brlFull = (v: number) => `R$ ${brl(v)}`

const pad = (n: number) => String(n).padStart(2, '0')
export const hora = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const dataLonga = (iso: string) => {
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}
export const dataHoraLonga = (iso: string) => `${dataLonga(iso)} às ${hora(iso)}`
export const dataCurta = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}
/** yyyy-mm-dd no fuso local */
export const diaLocal = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const somarMinutos = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString()
export const km = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`

export const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
export const primeiroNome = (n: string) => n.split(' ')[0]
