// "Adicionar ao calendário": link do Google Agenda e arquivo .ics (Apple, Outlook, etc.).

const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export interface EventoAgenda {
  id: string
  titulo: string
  inicio: string
  fim: string
  local: string
  detalhes: string
}

export function linkGoogleAgenda(e: EventoAgenda) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.titulo, dates: `${utc(e.inicio)}/${utc(e.fim)}`, location: e.local, details: e.detalhes })
  return `https://calendar.google.com/calendar/render?${p}`
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

export function arquivoIcs(e: EventoAgenda) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberHUB//PT-BR',
    'BEGIN:VEVENT',
    `UID:${e.id}@barberhub`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(e.fim)}`,
    `SUMMARY:${esc(e.titulo)}`,
    `LOCATION:${esc(e.local)}`,
    `DESCRIPTION:${esc(e.detalhes)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(e.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export function baixarIcs(e: EventoAgenda) {
  const url = URL.createObjectURL(new Blob([arquivoIcs(e)], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'barberhub-reserva.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
