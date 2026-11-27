// Regras de negócio (doc v1.4, seção 5, com as melhorias de 23/11/2026).
// Funções puras sobre o Banco: recebem o estado atual e devolvem o novo estado
// ou lançam RegraError. No modo Supabase as mesmas regras rodam em funções SQL
// (supabase/migrations), e os limites abaixo precisam ficar iguais aos de lá.

import type { Agendamento, Assinatura, Avaliacao, Banco, Barbearia, Horario, Jornada, Parceria, Profissional, Servico, StatusAssinatura, Usuario } from './types'
import { RAIO_PADRAO_KM } from '../data/seed'
import { uuid } from '../lib/id'

export class RegraError extends Error {}

/** Jornada usada enquanto o barbeiro não configura a dele. */
export const JORNADA_PADRAO: Jornada = { dias: [1, 2, 3, 4, 5, 6], inicio: '10:00', fim: '17:30', intervaloMin: 90 }
/** Cancelar ou remarcar só até este tempo antes do início. */
export const ANTECEDENCIA_CANCELAR_MIN = 120
/** Reservas futuras confirmadas que um cliente pode ter ao mesmo tempo. */
export const LIMITE_RESERVAS_ATIVAS = 3
export const INTERVALOS_PERMITIDOS = [30, 45, 60, 90, 120]

let relogio = () => Date.now()
/** Só para testes: fixa o "agora". */
export function definirRelogio(fn: () => number) {
  relogio = fn
}
export const agora = () => relogio()
const ehFuturo = (iso: string) => new Date(iso).getTime() > agora()

export const raioAplicado = (u: Usuario) => u.raioBuscaKm ?? RAIO_PADRAO_KM
export const jornadaDe = (p: Profissional | undefined) => p?.jornada ?? JORNADA_PADRAO

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function validarJornada(j: Jornada): Jornada {
  const dias = [...new Set(j.dias)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
  if (!dias.length) throw new RegraError('Escolha pelo menos um dia de atendimento.')
  if (!/^\d{2}:\d{2}$/.test(j.inicio) || !/^\d{2}:\d{2}$/.test(j.fim)) throw new RegraError('Horário inválido.')
  if (!INTERVALOS_PERMITIDOS.includes(j.intervaloMin)) throw new RegraError('Duração do intervalo inválida.')
  if (minutos(j.fim) - minutos(j.inicio) < j.intervaloMin) throw new RegraError('O expediente precisa caber pelo menos um intervalo.')
  return { dias, inicio: j.inicio, fim: j.fim, intervaloMin: j.intervaloMin }
}

/** Horários de início ("HH:MM") que a jornada abre no dia (yyyy-mm-dd). */
export function iniciosDoDia(j: Jornada, dia: string): string[] {
  const [y, m, d] = dia.split('-').map(Number)
  if (!j.dias.includes(new Date(y, m - 1, d).getDay())) return []
  const out: string[] = []
  for (let t = minutos(j.inicio); t + j.intervaloMin <= minutos(j.fim); t += j.intervaloMin) out.push(hhmm(t))
  return out
}

/** Resumo legível da jornada, ex.: "Seg a Sáb, 10:00 às 17:30". */
export function resumoJornada(j: Jornada) {
  const NOMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const d = [...j.dias].sort()
  const seguidos = d.length > 2 && d.every((x, i) => i === 0 || x === d[i - 1] + 1)
  const dias = seguidos ? `${NOMES[d[0]]} a ${NOMES[d[d.length - 1]]}` : d.map((x) => NOMES[x]).join(', ')
  return `${dias}, ${j.inicio} às ${j.fim}`
}

/**
 * 5.7 Preparar horários por data, a partir da jornada do profissional.
 * Cria os intervalos que faltam e remove os livres que saíram da jornada.
 * Nunca toca em intervalos ocupados ou bloqueados.
 */
export function prepararHorarios(db: Banco, profissionalId: string, dia: string): Banco {
  const prof = db.profissionais.find((p) => p.id === profissionalId)
  if (!prof) throw new RegraError('Profissional não encontrado.')
  if (!prof.barbeariaId) throw new RegraError('Profissional sem vínculo com barbearia.')
  const [y, m, d] = dia.split('-').map(Number)
  const hoje = new Date(agora())
  hoje.setHours(0, 0, 0, 0)
  if (new Date(y, m - 1, d) < hoje) throw new RegraError('Escolha hoje ou uma data futura.')

  const j = jornadaDe(prof)
  const ids = new Set<string>()
  const novos: Horario[] = []
  for (const ini of iniciosDoDia(j, dia)) {
    const [h, mi] = ini.split(':').map(Number)
    const inicio = new Date(y, m - 1, d, h, mi, 0, 0)
    const id = `${profissionalId}-${dia}-${ini.replace(':', '')}`
    ids.add(id)
    if (inicio.getTime() <= agora() || db.horarios.some((x) => x.id === id)) continue
    novos.push({
      id,
      profissionalId,
      barbeariaId: prof.barbeariaId,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + j.intervaloMin * 60000).toISOString(),
      status: 'Livre',
    })
  }
  const sair = (h: Horario) =>
    h.profissionalId === profissionalId && h.status === 'Livre' && ehFuturo(h.inicio) && sameDay(h.inicio, dia) && !ids.has(h.id)
  if (!novos.length && !db.horarios.some(sair)) return db
  // Se um intervalo que saiu já teve reserva (cancelada), fica bloqueado para manter o histórico.
  const usado = (h: Horario) => db.agendamentos.some((a) => a.horarioId === h.id)
  const restantes = db.horarios
    .filter((h) => !sair(h) || usado(h))
    .map((h) => (sair(h) ? { ...h, status: 'Bloqueado' as const } : h))
  return { ...db, horarios: [...restantes, ...novos] }
}

export function horariosLivres(db: Banco, profissionalId: string, dia: string) {
  return db.horarios
    .filter((h) => h.profissionalId === profissionalId && sameDay(h.inicio, dia))
    .filter((h) => h.status === 'Livre' && ehFuturo(h.inicio))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}

function sameDay(iso: string, dia: string) {
  const d = new Date(iso)
  const [y, m, dd] = dia.split('-').map(Number)
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === dd
}

const duracaoMin = (h: Horario) => (new Date(h.fim).getTime() - new Date(h.inicio).getTime()) / 60000
/** O serviço cabe no intervalo reservado? */
export const servicoCabe = (s: Servico, h: Horario) => s.duracaoMinutos <= duracaoMin(h)

/** Reservas confirmadas que ainda não começaram. */
export const reservasAtivas = (db: Banco, clienteEmail: string) =>
  db.agendamentos.filter((a) => a.clienteEmail === clienteEmail && a.status === 'Confirmado' && ehFuturo(a.inicio))

function verificarHorarioParaReserva(db: Banco, h: Horario, s: Servico, clienteEmail: string, ignorar?: string) {
  if (h.status !== 'Livre' || !ehFuturo(h.inicio)) throw new RegraError('Esse horário acabou de ficar indisponível. Escolha outro.')
  if (s.barbeariaId !== h.barbeariaId || !s.disponivel) throw new RegraError('Escolha um serviço.')
  if (!servicoCabe(s, h)) throw new RegraError('Esse serviço não cabe neste horário. Escolha outro serviço.')
  const choque = db.agendamentos.some(
    (a) => a.id !== ignorar && a.clienteEmail === clienteEmail && a.status === 'Confirmado' && a.inicio < h.fim && h.inicio < a.fim,
  )
  if (choque) throw new RegraError('Você já tem uma reserva nesse mesmo horário.')
}

/**
 * 5.1 Confirmar agendamento. Verificação e ocupação acontecem no mesmo passo.
 * Tentativas recusadas não viram registro: o erro volta direto para a tela.
 */
export function confirmarAgendamento(
  db: Banco,
  args: { cliente: Usuario; horarioId: string; servicoId: string },
): { db: Banco; agendamento: Agendamento } {
  const horario = db.horarios.find((h) => h.id === args.horarioId)
  if (!horario) throw new RegraError('Horário não encontrado.')
  const servico = db.servicos.find((s) => s.id === args.servicoId)
  if (!servico) throw new RegraError('Escolha um serviço.')
  if (reservasAtivas(db, args.cliente.email).length >= LIMITE_RESERVAS_ATIVAS)
    throw new RegraError(`Você já tem ${LIMITE_RESERVAS_ATIVAS} reservas futuras. Conclua ou cancele uma para agendar outra.`)
  verificarHorarioParaReserva(db, horario, servico, args.cliente.email)
  exigirBarbeariaEmDia(db, horario.barbeariaId)

  const ts = new Date(agora()).toISOString()
  const ag: Agendamento = {
    id: uuid(),
    protocolo: uuid(),
    barbeariaId: horario.barbeariaId,
    servicoId: servico.id,
    profissionalId: horario.profissionalId,
    horarioId: horario.id,
    clienteEmail: args.cliente.email,
    clienteNome: args.cliente.nome,
    inicio: horario.inicio,
    fim: horario.fim,
    status: 'Confirmado',
    precoReservado: precoNoApp(db, servico).preco,
    duracaoReservada: servico.duracaoMinutos,
    criadoEm: ts,
    atualizadoEm: ts,
  }
  return {
    db: {
      ...db,
      horarios: db.horarios.map((h) => (h.id === horario.id ? { ...h, status: 'Ocupado' } : h)),
      agendamentos: [...db.agendamentos, ag],
    },
    agendamento: ag,
  }
}

/** Ainda dá para cancelar ou remarcar? */
export const podeAlterar = (a: Agendamento) =>
  a.status === 'Confirmado' && new Date(a.inicio).getTime() - agora() >= ANTECEDENCIA_CANCELAR_MIN * 60000

function exigirAlteravel(a: Agendamento | undefined, usuario: Usuario, acao: string): Agendamento {
  if (!a) throw new RegraError('Agendamento não encontrado.')
  if (a.status !== 'Confirmado') throw new RegraError(`Só reservas confirmadas podem ser ${acao}s.`)
  if (a.clienteEmail !== usuario.email) throw new RegraError(`Apenas o cliente titular pode ${acao === 'cancelada' ? 'cancelar' : 'remarcar'}.`)
  if (!podeAlterar(a))
    throw new RegraError(`Só é possível ${acao === 'cancelada' ? 'cancelar' : 'remarcar'} até ${ANTECEDENCIA_CANCELAR_MIN / 60}h antes do horário. Fale com a barbearia.`)
  return a
}

/** 5.2 Cancelar: só o cliente titular, só Confirmado e com antecedência. Intervalo volta a Livre. */
export function cancelarAgendamento(db: Banco, agendamentoId: string, usuario: Usuario): Banco {
  const ag = exigirAlteravel(
    db.agendamentos.find((a) => a.id === agendamentoId),
    usuario,
    'cancelada',
  )
  const ts = new Date(agora()).toISOString()
  return {
    ...db,
    agendamentos: db.agendamentos.map((a) => (a.id === ag.id ? { ...a, status: 'Cancelado', atualizadoEm: ts } : a)),
    horarios: db.horarios.map((h) => (h.id === ag.horarioId && h.status === 'Ocupado' ? { ...h, status: 'Livre' } : h)),
  }
}

/** Remarcar: troca o horário da reserva (mesma barbearia e serviço) num passo só. */
export function remarcarAgendamento(db: Banco, agendamentoId: string, novoHorarioId: string, usuario: Usuario): { db: Banco; agendamento: Agendamento } {
  const ag = exigirAlteravel(
    db.agendamentos.find((a) => a.id === agendamentoId),
    usuario,
    'remarcada',
  )
  const novo = db.horarios.find((h) => h.id === novoHorarioId)
  if (!novo) throw new RegraError('Horário não encontrado.')
  if (novo.barbeariaId !== ag.barbeariaId) throw new RegraError('Escolha um horário na mesma barbearia.')
  const servico = db.servicos.find((s) => s.id === ag.servicoId)
  if (!servico) throw new RegraError('Serviço não encontrado.')
  // O serviço pode ter ficado indisponível depois da reserva; ao remarcar vale o que foi reservado.
  verificarHorarioParaReserva(db, novo, { ...servico, disponivel: true, duracaoMinutos: ag.duracaoReservada ?? servico.duracaoMinutos }, usuario.email, ag.id)
  exigirBarbeariaEmDia(db, novo.barbeariaId)
  const ts = new Date(agora()).toISOString()
  const atualizado: Agendamento = { ...ag, horarioId: novo.id, profissionalId: novo.profissionalId, inicio: novo.inicio, fim: novo.fim, atualizadoEm: ts }
  return {
    db: {
      ...db,
      agendamentos: db.agendamentos.map((a) => (a.id === ag.id ? atualizado : a)),
      horarios: db.horarios.map((h) =>
        h.id === ag.horarioId && h.status === 'Ocupado' ? { ...h, status: 'Livre' } : h.id === novo.id ? { ...h, status: 'Ocupado' } : h,
      ),
    },
    agendamento: atualizado,
  }
}

/** 5.3 Encerrar o atendimento: só o barbeiro atribuído, só depois do início. */
export function encerrarAtendimento(db: Banco, agendamentoId: string, usuario: Usuario, resultado: 'Finalizado' | 'Não compareceu'): Banco {
  const ag = db.agendamentos.find((a) => a.id === agendamentoId)
  if (!ag) throw new RegraError('Agendamento não encontrado.')
  if (usuario.papel !== 'Barbeiro' || usuario.profissionalId !== ag.profissionalId)
    throw new RegraError('Apenas o profissional atribuído pode encerrar o atendimento.')
  if (ag.status !== 'Confirmado') throw new RegraError('Só reservas confirmadas podem ser encerradas.')
  if (ehFuturo(ag.inicio)) throw new RegraError('O atendimento ainda não começou.')
  const ts = new Date(agora()).toISOString()
  return {
    ...db,
    agendamentos: db.agendamentos.map((a) => (a.id === ag.id ? { ...a, status: resultado, atualizadoEm: ts } : a)),
  }
}

/** Reserva confirmada cujo horário já começou: falta o barbeiro finalizar ou marcar a falta. */
export const aguardandoBarbeiro = (a: Agendamento) => a.status === 'Confirmado' && !ehFuturo(a.inicio)

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

function exigirBarbeiro(usuario: Usuario) {
  if (usuario.papel !== 'Barbeiro' || !usuario.profissionalId || !usuario.barbeariaId)
    throw new RegraError('Apenas barbeiros com vínculo podem fazer isso.')
  return { profissionalId: usuario.profissionalId, barbeariaId: usuario.barbeariaId }
}

/** Barbeiro define a própria jornada. Horários livres futuros se ajustam ao preparar cada dia. */
export function salvarJornada(db: Banco, usuario: Usuario, jornada: Jornada): Banco {
  const { profissionalId } = exigirBarbeiro(usuario)
  const j = validarJornada(jornada)
  return { ...db, profissionais: db.profissionais.map((p) => (p.id === profissionalId ? { ...p, jornada: j } : p)) }
}

export type ServicoEditavel = Pick<Servico, 'nome' | 'descricao' | 'preco' | 'duracaoMinutos' | 'categoria' | 'inclui' | 'disponivel' | 'icone'> & { id?: string }

export function validarServico(s: ServicoEditavel): ServicoEditavel {
  const nome = s.nome.trim()
  if (nome.length < 2 || nome.length > 60) throw new RegraError('Dê um nome ao serviço (2 a 60 letras).')
  if (!Number.isFinite(s.preco) || s.preco < 0 || s.preco > 10000) throw new RegraError('Preço inválido.')
  if (!Number.isInteger(s.duracaoMinutos) || s.duracaoMinutos < 5 || s.duracaoMinutos > 240) throw new RegraError('Duração entre 5 e 240 minutos.')
  return { ...s, nome, descricao: s.descricao.trim().slice(0, 200), categoria: s.categoria.trim().slice(0, 40), inclui: s.inclui.trim().slice(0, 120) }
}

/** Barbeiro cria ou edita um serviço da própria unidade. */
export function salvarServico(db: Banco, usuario: Usuario, servico: ServicoEditavel): { db: Banco; servico: Servico } {
  const { barbeariaId } = exigirBarbeiro(usuario)
  const v = validarServico(servico)
  if (v.id) {
    const atual = db.servicos.find((s) => s.id === v.id)
    if (!atual || atual.barbeariaId !== barbeariaId) throw new RegraError('Serviço não encontrado.')
    const novo: Servico = { ...atual, ...v, id: atual.id, barbeariaId }
    return { db: { ...db, servicos: db.servicos.map((s) => (s.id === atual.id ? novo : s)) }, servico: novo }
  }
  const novo: Servico = { ...v, id: `srv-${uuid().slice(0, 8)}`, barbeariaId }
  return { db: { ...db, servicos: [...db.servicos, novo] }, servico: novo }
}

export type DadosBarbearia = Pick<Barbearia, 'descricao' | 'telefone' | 'whatsapp'>

/** Só dígitos, com DDD (10 ou 11 dígitos). Vazio apaga. */
export function normalizarTelefone(t: string | undefined) {
  const d = (t ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (!d) return undefined
  if (d.length < 10 || d.length > 11) throw new RegraError('Telefone com DDD, ex.: (92) 99999-9999.')
  return d
}

/** Barbeiro atualiza descrição e contato da unidade vinculada. */
export function atualizarBarbearia(db: Banco, usuario: Usuario, dados: DadosBarbearia): Banco {
  const { barbeariaId } = exigirBarbeiro(usuario)
  const patch = {
    descricao: dados.descricao.trim().slice(0, 400),
    telefone: normalizarTelefone(dados.telefone),
    whatsapp: normalizarTelefone(dados.whatsapp),
  }
  return { ...db, barbearias: db.barbearias.map((b) => (b.id === barbeariaId ? { ...b, ...patch } : b)) }
}

/** Avaliar: cliente titular, atendimento finalizado, uma vez por reserva. */
export function avaliarAtendimento(db: Banco, agendamentoId: string, usuario: Usuario, nota: number, comentario: string): Banco {
  const ag = db.agendamentos.find((a) => a.id === agendamentoId)
  if (!ag || ag.clienteEmail !== usuario.email) throw new RegraError('Agendamento não encontrado.')
  if (ag.status !== 'Finalizado') throw new RegraError('Só atendimentos finalizados podem ser avaliados.')
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new RegraError('Escolha de 1 a 5 estrelas.')
  if (db.avaliacoes.some((a) => a.agendamentoId === ag.id)) throw new RegraError('Você já avaliou este atendimento.')
  const av: Avaliacao = {
    id: uuid(),
    agendamentoId: ag.id,
    barbeariaId: ag.barbeariaId,
    profissionalId: ag.profissionalId,
    clienteNome: (usuario.nome.split(' ')[0] || 'Cliente').slice(0, 40),
    nota,
    comentario: comentario.trim().slice(0, 500),
    criadoEm: new Date(agora()).toISOString(),
  }
  return { ...db, avaliacoes: [...db.avaliacoes, av] }
}

/** Média e quantidade de avaliações de uma barbearia. */
export function notaDaBarbearia(db: Banco, barbeariaId: string) {
  const l = db.avaliacoes.filter((a) => a.barbeariaId === barbeariaId)
  if (!l.length) return null
  return { media: l.reduce((s, a) => s + a.nota, 0) / l.length, total: l.length }
}

export const noHistorico = (a: Agendamento) => a.status === 'Cancelado' || a.status === 'Finalizado' || a.status === 'Não compareceu'

/** Término real do serviço (pendência da v1.4): início + duração reservada. */
export function terminoServico(db: Banco, a: Agendamento) {
  const dur = a.duracaoReservada ?? db.servicos.find((s) => s.id === a.servicoId)?.duracaoMinutos ?? 0
  return new Date(new Date(a.inicio).getTime() + dur * 60000).toISOString()
}

/** Painel do barbeiro: números do dia, da semana e do mês. */
export function resumoBarbeiro(db: Banco, profissionalId: string) {
  const ref = new Date(agora())
  const iniDia = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()
  const fimDia = iniDia + 864e5
  const iniSemana = iniDia - ((ref.getDay() + 6) % 7) * 864e5 // segunda-feira
  const fimSemana = iniSemana + 7 * 864e5
  const iniMes = new Date(ref.getFullYear(), ref.getMonth(), 1).getTime()
  const meus = db.agendamentos.filter((a) => a.profissionalId === profissionalId)
  const t = (a: Agendamento) => new Date(a.inicio).getTime()
  const valor = (l: Agendamento[]) => l.reduce((s, a) => s + (a.precoReservado ?? 0), 0)
  const ativos = (l: Agendamento[]) => l.filter((a) => a.status === 'Confirmado' || a.status === 'Finalizado')
  const hoje = ativos(meus.filter((a) => t(a) >= iniDia && t(a) < fimDia))
  const semana = ativos(meus.filter((a) => t(a) >= iniSemana && t(a) < fimSemana))
  const mesFinalizados = meus.filter((a) => a.status === 'Finalizado' && t(a) >= iniMes && t(a) < fimDia)
  const mesFaltas = meus.filter((a) => a.status === 'Não compareceu' && t(a) >= iniMes).length
  const notas = db.avaliacoes.filter((a) => a.profissionalId === profissionalId)
  return {
    hoje: hoje.length,
    previstoHoje: valor(hoje),
    semana: semana.length,
    previstoSemana: valor(semana),
    faturadoMes: valor(mesFinalizados),
    atendidosMes: mesFinalizados.length,
    faltasMes: mesFaltas,
    pendentes: meus.filter(aguardandoBarbeiro).length,
    nota: notas.length ? notas.reduce((s, a) => s + a.nota, 0) / notas.length : null,
    totalNotas: notas.length,
  }
}

// ───────────── Modelo de receita: assinatura e parceria (27/11/2026) ─────────────
// Espelha supabase/migrations/20261127000000_assinaturas_parcerias.sql.

/** Dias de teste grátis de uma barbearia nova. */
export const DIAS_TESTE = 30
/** Descontos que a parceira pode oferecer em todos os serviços agendados pelo app. */
export const DESCONTOS_PARCERIA = [10, 15, 20, 25, 30]
/** Duração de cada parceria, em dias. */
export const PERIODOS_PARCERIA = [30, 90]

const depoisDeAgora = (iso?: string) => !!iso && new Date(iso).getTime() > agora()

/** RN08: aparece no catálogo e no mapa, e recebe reservas, só com assinatura em dia (teste ou paga). */
export const barbeariaVisivel = (b: Barbearia) => depoisDeAgora(b.visivelAte)

function exigirBarbeariaEmDia(db: Banco, barbeariaId: string) {
  const b = db.barbearias.find((x) => x.id === barbeariaId)
  if (!b || !barbeariaVisivel(b)) throw new RegraError('Esta barbearia não está recebendo reservas no momento.')
}

export type SituacaoAssinatura = StatusAssinatura | 'Vencida' | 'Sem assinatura'

/** Situação para mostrar ao barbeiro. Vencida = o prazo (teste ou pago) acabou. */
export function situacaoAssinatura(a: Assinatura | undefined): SituacaoAssinatura {
  if (!a) return 'Sem assinatura'
  return depoisDeAgora(a.validaAte) ? a.status : 'Vencida'
}

export const assinaturaDe = (db: Banco, barbeariaId: string | undefined) => db.assinaturas.find((a) => a.barbeariaId === barbeariaId)

/** RN09: parceria em vigor (aprovada e dentro do período). Só ela dá destaque, selo e preço. */
export function parceriaVigente(db: Banco, barbeariaId: string): Parceria | undefined {
  return db.parcerias.find(
    (p) => p.barbeariaId === barbeariaId && p.status === 'Ativa' && !!p.inicio && new Date(p.inicio).getTime() <= agora() && depoisDeAgora(p.fim),
  )
}

/** Parceria pedida ou em vigor da unidade (no máximo uma aberta por vez). */
export function parceriaAberta(db: Banco, barbeariaId: string): Parceria | undefined {
  return db.parcerias.find((p) => p.barbeariaId === barbeariaId && (p.status === 'Solicitada' || (p.status === 'Ativa' && depoisDeAgora(p.fim))))
}

const centavos = (v: number) => Math.round(v * 100) / 100

/** Preço de um serviço agendado pelo app: com o desconto da parceria, se houver. */
export function precoNoApp(db: Banco, s: Servico): { preco: number; original?: number; descontoPct?: number } {
  const p = parceriaVigente(db, s.barbeariaId)
  if (!p) return { preco: s.preco }
  return { preco: centavos((s.preco * (100 - p.descontoPct)) / 100), original: s.preco, descontoPct: p.descontoPct }
}

const iso = (ms: number) => new Date(ms).toISOString()

function comVisibilidade(db: Banco, a: Assinatura): Banco {
  return {
    ...db,
    assinaturas: [...db.assinaturas.filter((x) => x.barbeariaId !== a.barbeariaId), a],
    barbearias: db.barbearias.map((b) => (b.id === a.barbeariaId ? { ...b, visivelAte: a.validaAte } : b)),
  }
}

/** RF15/RF16: escolher, trocar ou renovar o plano. No teste só troca; fora dele fica Pendente até o pagamento. */
export function escolherPlano(db: Banco, usuario: Usuario, planoId: string): { db: Banco; assinatura: Assinatura } {
  const { barbeariaId } = exigirBarbeiro(usuario)
  const plano = db.planos.find((p) => p.id === planoId)
  if (!plano) throw new RegraError('Plano não encontrado.')
  const equipe = db.profissionais.filter((p) => p.barbeariaId === barbeariaId).length
  if (plano.maxProfissionais > 0 && equipe > plano.maxProfissionais)
    throw new RegraError(`Sua equipe tem ${equipe} barbeiros; o plano ${plano.nome} permite até ${plano.maxProfissionais}.`)
  const ts = iso(agora())
  const atual = assinaturaDe(db, barbeariaId)
  const assinatura: Assinatura = atual
    ? { ...atual, planoId, status: atual.status === 'Teste' && depoisDeAgora(atual.validaAte) ? 'Teste' : 'Pendente', atualizadoEm: ts }
    : { id: barbeariaId, barbeariaId, planoId, status: 'Teste', inicio: ts, validaAte: iso(agora() + DIAS_TESTE * 864e5), atualizadoEm: ts }
  return { db: comVisibilidade(db, assinatura), assinatura }
}

/** RF16: cancelar. A unidade continua visível até o fim do período já pago (ou do teste). */
export function cancelarAssinatura(db: Banco, usuario: Usuario): Banco {
  const { barbeariaId } = exigirBarbeiro(usuario)
  const a = assinaturaDe(db, barbeariaId)
  if (!a || a.status === 'Cancelada') throw new RegraError('Não há assinatura para cancelar.')
  return comVisibilidade(db, { ...a, status: 'Cancelada', atualizadoEm: iso(agora()) })
}

/** RF17: aderir à parceria. Exige assinatura em dia e nenhuma parceria aberta. A equipe aprova depois. */
export function solicitarParceria(db: Banco, usuario: Usuario, descontoPct: number, dias: number): { db: Banco; parceria: Parceria } {
  const { barbeariaId } = exigirBarbeiro(usuario)
  if (!DESCONTOS_PARCERIA.includes(descontoPct)) throw new RegraError('Escolha um desconto entre 10% e 30%.')
  if (!PERIODOS_PARCERIA.includes(dias)) throw new RegraError('Escolha 30 ou 90 dias.')
  const a = assinaturaDe(db, barbeariaId)
  if (!a || !depoisDeAgora(a.validaAte)) throw new RegraError('Renove a assinatura para virar parceira.')
  if (parceriaAberta(db, barbeariaId)) throw new RegraError('Sua barbearia já tem uma parceria ativa ou em análise.')
  const parceria: Parceria = { id: uuid(), barbeariaId, descontoPct, dias, status: 'Solicitada', criadoEm: iso(agora()) }
  return { db: { ...db, parcerias: [...db.parcerias, parceria] }, parceria }
}

/** Cancela o pedido em análise ou encerra a parceria em vigor (o destaque e o desconto acabam na hora). */
export function encerrarParceria(db: Banco, usuario: Usuario, parceriaId: string): Banco {
  const { barbeariaId } = exigirBarbeiro(usuario)
  const p = db.parcerias.find((x) => x.id === parceriaId && x.barbeariaId === barbeariaId && (x.status === 'Solicitada' || x.status === 'Ativa'))
  if (!p) throw new RegraError('Parceria não encontrada.')
  const fim = p.status === 'Ativa' && p.fim && depoisDeAgora(p.fim) ? iso(agora()) : p.fim
  const novo: Parceria = { ...p, status: p.status === 'Solicitada' ? 'Cancelada' : 'Encerrada', fim }
  return { ...db, parcerias: db.parcerias.map((x) => (x.id === p.id ? novo : x)) }
}

/** Só no modo demonstração: faz o papel da equipe e aprova o pedido de parceria. */
export function aprovarParceria(db: Banco, parceriaId: string): Banco {
  const ms = agora()
  return {
    ...db,
    parcerias: db.parcerias.map((p) => (p.id === parceriaId && p.status === 'Solicitada' ? { ...p, status: 'Ativa', inicio: iso(ms), fim: iso(ms + p.dias * 864e5) } : p)),
  }
}

/** Só no modo demonstração: faz o papel da equipe e confirma o pagamento de um mês. */
export function confirmarPagamento(db: Banco, barbeariaId: string): Banco {
  const a = assinaturaDe(db, barbeariaId)
  if (!a) return db
  const base = Math.max(new Date(a.validaAte).getTime(), agora())
  const mais = new Date(base)
  mais.setMonth(mais.getMonth() + 1)
  return comVisibilidade(db, { ...a, status: 'Ativa', validaAte: iso(mais.getTime()), atualizadoEm: iso(agora()) })
}
