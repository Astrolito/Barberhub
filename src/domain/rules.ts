// Regras de negócio (doc v1.4, seção 5). Funções puras sobre o Banco:
// recebem o estado atual e devolvem o novo estado ou um erro de regra.
// Ao migrar para um backend, estas mesmas regras viram transações no servidor.

import type { Agendamento, Banco, Horario, Usuario } from './types'
import { RAIO_PADRAO_KM } from '../data/seed'
import { uuid } from '../lib/id'

export class RegraError extends Error {}

export const DURACAO_INTERVALO_MIN = 90
export const HORAS_INTERVALO = [10, 14]

const agora = () => Date.now()
const ehFuturo = (iso: string) => new Date(iso).getTime() > agora()

export const raioAplicado = (u: Usuario) => (u.raioBuscaKm ?? RAIO_PADRAO_KM)

/** 5.7 Preparar horários por data: cria só os intervalos ausentes e futuros. */
export function prepararHorarios(db: Banco, profissionalId: string, dia: string): Banco {
  const prof = db.profissionais.find((p) => p.id === profissionalId)
  if (!prof) throw new RegraError('Profissional não encontrado.')
  if (!prof.barbeariaId) throw new RegraError('Profissional sem vínculo com barbearia.')
  const [y, m, d] = dia.split('-').map(Number)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  if (new Date(y, m - 1, d) < hoje) throw new RegraError('Escolha hoje ou uma data futura.')

  const novos: Horario[] = []
  for (const h of HORAS_INTERVALO) {
    const inicio = new Date(y, m - 1, d, h, 0, 0, 0)
    if (inicio.getTime() <= agora()) continue
    const id = `${profissionalId}-${dia}-${String(h).padStart(2, '0')}00`
    if (db.horarios.some((x) => x.id === id)) continue
    novos.push({
      id,
      profissionalId,
      barbeariaId: prof.barbeariaId,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + DURACAO_INTERVALO_MIN * 60000).toISOString(),
      status: 'Livre',
    })
  }
  return novos.length ? { ...db, horarios: [...db.horarios, ...novos] } : db
}

export function horariosLivres(db: Banco, profissionalId: string, dia: string) {
  return db.horarios
    .filter((h) => h.profissionalId === profissionalId && h.inicio.length && sameDay(h.inicio, dia))
    .filter((h) => h.status === 'Livre' && ehFuturo(h.inicio))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}

function sameDay(iso: string, dia: string) {
  const d = new Date(iso)
  const [y, m, dd] = dia.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === dd
}

/**
 * 5.1 Confirmar agendamento. Verificação e ocupação acontecem no mesmo
 * passo síncrono sobre o estado, então não há janela entre checar e ocupar
 * (melhoria em relação ao fluxo sequencial do Glide).
 */
export function confirmarAgendamento(
  db: Banco,
  args: { clienteEmail: string; horarioId: string; servicoId: string },
): { db: Banco; agendamento: Agendamento } {
  const horario = db.horarios.find((h) => h.id === args.horarioId)
  if (!horario) throw new RegraError('Horário não encontrado.')
  const servico = db.servicos.find((s) => s.id === args.servicoId)
  if (!servico) throw new RegraError('Escolha um serviço.')
  const prof = db.profissionais.find((p) => p.id === horario.profissionalId)
  const ts = new Date().toISOString()

  const base: Agendamento = {
    id: uuid(),
    protocolo: uuid(),
    barbeariaId: horario.barbeariaId,
    servicoId: servico.id,
    profissionalId: horario.profissionalId,
    horarioId: horario.id,
    clienteEmail: args.clienteEmail,
    barbeiroEmail: prof?.emailAcesso,
    inicio: horario.inicio,
    fim: horario.fim,
    status: 'Confirmado',
    criadoEm: ts,
    atualizadoEm: ts,
  }

  if (horario.status !== 'Livre' || !ehFuturo(horario.inicio)) {
    const tentativa: Agendamento = { ...base, status: 'Indisponível' }
    return { db: { ...db, agendamentos: [...db.agendamentos, tentativa] }, agendamento: tentativa }
  }

  const ag: Agendamento = { ...base, precoReservado: servico.preco, duracaoReservada: servico.duracaoMinutos }
  return {
    db: {
      ...db,
      horarios: db.horarios.map((h) => (h.id === horario.id ? { ...h, status: 'Ocupado' } : h)),
      agendamentos: [...db.agendamentos, ag],
    },
    agendamento: ag,
  }
}

/** 5.2 Cancelar: só o cliente titular, só Confirmado. Intervalo volta a Livre. */
export function cancelarAgendamento(db: Banco, agendamentoId: string, usuario: Usuario): Banco {
  const ag = db.agendamentos.find((a) => a.id === agendamentoId)
  if (!ag) throw new RegraError('Agendamento não encontrado.')
  if (ag.status !== 'Confirmado') throw new RegraError('Só reservas confirmadas podem ser canceladas.')
  if (ag.clienteEmail !== usuario.email) throw new RegraError('Apenas o cliente titular pode cancelar.')
  const ts = new Date().toISOString()
  return {
    ...db,
    agendamentos: db.agendamentos.map((a) => (a.id === ag.id ? { ...a, status: 'Cancelado', atualizadoEm: ts } : a)),
    horarios: db.horarios.map((h) => (h.id === ag.horarioId && h.status === 'Ocupado' ? { ...h, status: 'Livre' } : h)),
  }
}

/** 5.3 Finalizar: barbeiro atribuído; intervalo permanece Ocupado. */
export function finalizarAtendimento(db: Banco, agendamentoId: string, usuario: Usuario): Banco {
  const ag = db.agendamentos.find((a) => a.id === agendamentoId)
  if (!ag) throw new RegraError('Agendamento não encontrado.')
  if (usuario.papel !== 'Barbeiro' || usuario.profissionalId !== ag.profissionalId)
    throw new RegraError('Apenas o profissional atribuído pode finalizar.')
  if (ag.status !== 'Confirmado') throw new RegraError('Só reservas confirmadas podem ser finalizadas.')
  const ts = new Date().toISOString()
  return {
    ...db,
    agendamentos: db.agendamentos.map((a) => (a.id === ag.id ? { ...a, status: 'Finalizado', atualizadoEm: ts } : a)),
  }
}

/** 5.4 Bloquear (Livre → Bloqueado) e liberar (Bloqueado → Livre). Nunca toca Ocupado. */
export function alternarBloqueio(db: Banco, horarioId: string, usuario: Usuario): Banco {
  const h = db.horarios.find((x) => x.id === horarioId)
  if (!h) throw new RegraError('Horário não encontrado.')
  if (usuario.papel !== 'Barbeiro' || usuario.profissionalId !== h.profissionalId)
    throw new RegraError('Apenas o profissional do horário pode alterar.')
  if (h.status === 'Ocupado') throw new RegraError('Horário ocupado por uma reserva.')
  const status = h.status === 'Livre' ? 'Bloqueado' : 'Livre'
  return { ...db, horarios: db.horarios.map((x) => (x.id === h.id ? { ...x, status } : x)) }
}

export const noHistorico = (a: Agendamento) => a.status === 'Cancelado' || a.status === 'Finalizado'

/** Término real do serviço (pendência da v1.4): início + duração reservada. */
export function terminoServico(db: Banco, a: Agendamento) {
  const dur = a.duracaoReservada ?? db.servicos.find((s) => s.id === a.servicoId)?.duracaoMinutos ?? 0
  return new Date(new Date(a.inicio).getTime() + dur * 60000).toISOString()
}
