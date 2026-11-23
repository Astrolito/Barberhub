// Lembrete 1h antes de cada reserva confirmada, só no app instalado (Capacitor).
// No navegador não há como notificar com o site fechado, então lá fica só o
// "Adicionar ao calendário" (src/lib/calendario.ts).

import { Capacitor } from '@capacitor/core'
import type { Banco } from '../domain/types'
import { hora } from './format'

const ANTES_MIN = 60

/** Id numérico estável para a notificação (o plugin exige int de 32 bits). */
function idNumerico(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

let fila: Promise<void> = Promise.resolve()

export function sincronizarLembretes(db: Banco, email: string) {
  if (!Capacitor.isNativePlatform()) return
  fila = fila.then(() => sincronizar(db, email)).catch(() => {})
}

async function sincronizar(db: Banco, email: string) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const desejados = db.agendamentos
    .filter((a) => a.clienteEmail === email && a.status === 'Confirmado')
    .map((a) => ({ a, quando: new Date(new Date(a.inicio).getTime() - ANTES_MIN * 60000) }))
    .filter((x) => x.quando.getTime() > Date.now())

  const pendentes = (await LocalNotifications.getPending()).notifications.filter((n) => n.extra?.tipo === 'lembrete')
  const querIds = new Set(desejados.map((x) => idNumerico(x.a.id + x.a.inicio)))
  const sobrando = pendentes.filter((n) => !querIds.has(n.id))
  if (sobrando.length) await LocalNotifications.cancel({ notifications: sobrando.map((n) => ({ id: n.id })) })

  const jaTem = new Set(pendentes.map((n) => n.id))
  const novos = desejados.filter((x) => !jaTem.has(idNumerico(x.a.id + x.a.inicio)))
  if (!novos.length) return
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return
  await LocalNotifications.schedule({
    notifications: novos.map(({ a, quando }) => {
      const servico = db.servicos.find((s) => s.id === a.servicoId)?.nome ?? 'Seu atendimento'
      const local = db.barbearias.find((b) => b.id === a.barbeariaId)?.nome ?? ''
      return {
        id: idNumerico(a.id + a.inicio),
        title: `${servico} às ${hora(a.inicio)}`,
        body: `Daqui a 1 hora${local ? ` na ${local}` : ''}. Chegue com 10 min de antecedência.`,
        schedule: { at: quando, allowWhileIdle: true },
        extra: { tipo: 'lembrete', agendamentoId: a.id },
      }
    }),
  })
}
