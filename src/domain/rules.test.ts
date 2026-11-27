import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as R from './rules'
import { criarSeed } from '../data/seed'
import type { Banco, Usuario } from './types'

// Relógio fixo: segunda-feira, 23/11/2026, 08:00 no fuso do teste (TZ=America/Manaus no script).
const AGORA = new Date(2026, 10, 23, 8, 0).getTime()
let agora = AGORA
const avancar = (min: number) => (agora += min * 60000)

let db: Banco
let cliente: Usuario
let barbeiro: Usuario

beforeEach(() => {
  agora = AGORA
  R.definirRelogio(() => agora)
  // Sem as parcerias de demonstração, para os preços dos testes serem os de tabela.
  db = { ...criarSeed(AGORA), parcerias: [] }
  cliente = db.usuarios.find((u) => u.papel === 'Cliente')!
  barbeiro = db.usuarios.find((u) => u.papel === 'Barbeiro')!
})
afterEach(() => R.definirRelogio(() => Date.now()))

const DIA = '2026-11-23'
const preparar = (dia = DIA, prof = 'prof-001') => (db = R.prepararHorarios(db, prof, dia))
const livre = (hhmm: string, dia = DIA, prof = 'prof-001') => `${prof}-${dia}-${hhmm.replace(':', '')}`
const reservar = (horarioId: string, quem = cliente, servicoId = 'srv-001') => {
  const r = R.confirmarAgendamento(db, { cliente: quem, horarioId, servicoId })
  db = r.db
  return r.agendamento
}

describe('agenda configurável', () => {
  it('gera os horários da jornada padrão', () => {
    expect(R.iniciosDoDia(R.JORNADA_PADRAO, DIA)).toEqual(['10:00', '11:30', '13:00', '14:30', '16:00'])
  })

  it('não abre horários em dia que não atende (domingo)', () => {
    expect(R.iniciosDoDia(R.JORNADA_PADRAO, '2026-11-29')).toEqual([])
  })

  it('prepara só horários futuros', () => {
    agora = new Date(2026, 10, 23, 12, 0).getTime()
    preparar()
    expect(R.horariosLivres(db, 'prof-001', DIA).map((h) => h.id)).toEqual([livre('13:00'), livre('14:30'), livre('16:00')])
  })

  it('ao mudar a jornada, remove livres que saíram e mantém ocupados', () => {
    preparar()
    reservar(livre('11:30'))
    db = R.salvarJornada(db, barbeiro, { dias: [1, 2, 3, 4, 5], inicio: '09:00', fim: '12:00', intervaloMin: 60 })
    preparar()
    const doDia = db.horarios.filter((h) => h.profissionalId === 'prof-001').map((h) => `${h.id}:${h.status}`)
    expect(doDia).toContain(`${livre('11:30')}:Ocupado`)
    expect(doDia).toContain(`${livre('09:00')}:Livre`)
    expect(doDia).not.toContain(`${livre('14:30')}:Livre`)
  })

  it('bloqueia (em vez de apagar) intervalo fora da jornada que já teve reserva', () => {
    preparar()
    const ag = reservar(livre('16:00'))
    db = R.cancelarAgendamento(db, ag.id, cliente)
    db = R.salvarJornada(db, barbeiro, { dias: [1], inicio: '10:00', fim: '12:00', intervaloMin: 60 })
    preparar()
    expect(db.horarios.find((h) => h.id === livre('16:00'))?.status).toBe('Bloqueado')
  })

  it('valida a jornada', () => {
    expect(() => R.validarJornada({ dias: [], inicio: '10:00', fim: '12:00', intervaloMin: 60 })).toThrow(/pelo menos um dia/)
    expect(() => R.validarJornada({ dias: [1], inicio: '10:00', fim: '10:30', intervaloMin: 60 })).toThrow(/caber/)
    expect(() => R.validarJornada({ dias: [1], inicio: '10:00', fim: '12:00', intervaloMin: 50 })).toThrow(/intervalo/)
  })

  it('só barbeiro com vínculo salva jornada', () => {
    expect(() => R.salvarJornada(db, cliente, R.JORNADA_PADRAO)).toThrow(/barbeiros/)
  })
})

describe('confirmar', () => {
  beforeEach(() => preparar())

  it('ocupa o horário e guarda nome, preço e duração', () => {
    const ag = reservar(livre('10:00'))
    expect(ag).toMatchObject({ status: 'Confirmado', clienteNome: cliente.nome, precoReservado: 55, duracaoReservada: 40 })
    expect(db.horarios.find((h) => h.id === livre('10:00'))?.status).toBe('Ocupado')
  })

  it('recusa horário ocupado sem gravar tentativa', () => {
    reservar(livre('10:00'))
    const antes = db.agendamentos.length
    expect(() => reservar(livre('10:00'), barbeiro)).toThrow(/indisponível/)
    expect(db.agendamentos.length).toBe(antes)
  })

  it('limita a 3 reservas futuras', () => {
    reservar(livre('10:00'))
    reservar(livre('11:30'))
    reservar(livre('13:00'))
    expect(() => reservar(livre('14:30'))).toThrow(/3 reservas futuras/)
  })

  it('impede duas reservas no mesmo horário com barbeiros diferentes', () => {
    preparar(DIA, 'prof-002')
    reservar(livre('10:00'))
    expect(() => reservar(livre('10:00', DIA, 'prof-002'))).toThrow(/mesmo horário/)
  })

  it('recusa serviço que não cabe no intervalo', () => {
    db = R.salvarJornada(db, barbeiro, { dias: [1], inicio: '10:00', fim: '12:00', intervaloMin: 30 })
    db = { ...db, horarios: db.horarios.filter((h) => h.profissionalId !== 'prof-001') }
    preparar()
    expect(() => reservar(livre('10:00'), cliente, 'srv-003')).toThrow(/não cabe/)
  })
})

describe('cancelar e remarcar', () => {
  beforeEach(() => preparar())

  it('cancela com antecedência e libera o horário', () => {
    const ag = reservar(livre('13:00'))
    db = R.cancelarAgendamento(db, ag.id, cliente)
    expect(db.agendamentos.find((a) => a.id === ag.id)?.status).toBe('Cancelado')
    expect(db.horarios.find((h) => h.id === ag.horarioId)?.status).toBe('Livre')
  })

  it('não cancela a menos de 2h do horário', () => {
    const ag = reservar(livre('10:00'))
    avancar(61) // 09:01, faltam 59 min
    expect(() => R.cancelarAgendamento(db, ag.id, cliente)).toThrow(/2h antes/)
  })

  it('só o titular cancela', () => {
    const ag = reservar(livre('13:00'))
    expect(() => R.cancelarAgendamento(db, ag.id, barbeiro)).toThrow(/titular/)
  })

  it('remarca trocando os horários num passo só', () => {
    const ag = reservar(livre('13:00'))
    const r = R.remarcarAgendamento(db, ag.id, livre('16:00'), cliente)
    db = r.db
    expect(r.agendamento).toMatchObject({ id: ag.id, horarioId: livre('16:00'), status: 'Confirmado' })
    expect(db.horarios.find((h) => h.id === livre('13:00'))?.status).toBe('Livre')
    expect(db.horarios.find((h) => h.id === livre('16:00'))?.status).toBe('Ocupado')
  })

  it('remarcar pode trocar de barbeiro na mesma unidade', () => {
    preparar(DIA, 'prof-002')
    const ag = reservar(livre('13:00'))
    const r = R.remarcarAgendamento(db, ag.id, livre('14:30', DIA, 'prof-002'), cliente)
    expect(r.agendamento.profissionalId).toBe('prof-002')
  })

  it('não remarca para horário ocupado', () => {
    const ag = reservar(livre('13:00'))
    reservar(livre('16:00'), barbeiro)
    expect(() => R.remarcarAgendamento(db, ag.id, livre('16:00'), cliente)).toThrow(/indisponível/)
  })
})

describe('encerrar atendimento', () => {
  beforeEach(() => preparar())

  it('não finaliza antes do início', () => {
    const ag = reservar(livre('10:00'))
    expect(() => R.encerrarAtendimento(db, ag.id, barbeiro, 'Finalizado')).toThrow(/não começou/)
  })

  it('finaliza depois do início e o horário segue ocupado', () => {
    const ag = reservar(livre('10:00'))
    avancar(125)
    expect(R.aguardandoBarbeiro(db.agendamentos.find((a) => a.id === ag.id)!)).toBe(true)
    db = R.encerrarAtendimento(db, ag.id, barbeiro, 'Finalizado')
    expect(db.agendamentos.find((a) => a.id === ag.id)?.status).toBe('Finalizado')
    expect(db.horarios.find((h) => h.id === ag.horarioId)?.status).toBe('Ocupado')
  })

  it('registra falta', () => {
    const ag = reservar(livre('10:00'))
    avancar(125)
    db = R.encerrarAtendimento(db, ag.id, barbeiro, 'Não compareceu')
    expect(db.agendamentos.find((a) => a.id === ag.id)?.status).toBe('Não compareceu')
  })

  it('só o profissional atribuído encerra', () => {
    const ag = reservar(livre('10:00'))
    avancar(125)
    expect(() => R.encerrarAtendimento(db, ag.id, cliente, 'Finalizado')).toThrow(/profissional atribuído/)
  })
})

describe('avaliações', () => {
  it('avalia uma vez, só depois de finalizado', () => {
    preparar()
    const ag = reservar(livre('10:00'))
    expect(() => R.avaliarAtendimento(db, ag.id, cliente, 5, '')).toThrow(/finalizados/)
    avancar(125)
    db = R.encerrarAtendimento(db, ag.id, barbeiro, 'Finalizado')
    db = R.avaliarAtendimento(db, ag.id, cliente, 4, '  Ótimo corte  ')
    expect(db.avaliacoes[0]).toMatchObject({ nota: 4, comentario: 'Ótimo corte', barbeariaId: 'bb001' })
    expect(R.notaDaBarbearia(db, 'bb001')).toEqual({ media: 4, total: 1 })
    expect(() => R.avaliarAtendimento(db, ag.id, cliente, 5, '')).toThrow(/já avaliou/)
  })

  it('nota precisa ser de 1 a 5', () => {
    preparar()
    const ag = reservar(livre('10:00'))
    avancar(125)
    db = R.encerrarAtendimento(db, ag.id, barbeiro, 'Finalizado')
    expect(() => R.avaliarAtendimento(db, ag.id, cliente, 6, '')).toThrow(/1 a 5/)
  })
})

describe('área do barbeiro', () => {
  it('cria e edita serviço só da própria unidade', () => {
    const { db: d1, servico } = R.salvarServico(db, barbeiro, { nome: 'Sobrancelha', descricao: '', preco: 15, duracaoMinutos: 10, categoria: '', inclui: '', disponivel: true, icone: 'pezinho' })
    expect(servico.barbeariaId).toBe('bb001')
    const { servico: editado } = R.salvarServico(d1, barbeiro, { ...servico, preco: 18, disponivel: false })
    expect(editado).toMatchObject({ preco: 18, disponivel: false })
    expect(() => R.salvarServico(db, cliente, servico)).toThrow(/barbeiros/)
  })

  it('valida telefone com DDD', () => {
    expect(R.normalizarTelefone('(92) 99999-1234')).toBe('92999991234')
    expect(R.normalizarTelefone('+55 92 3333-1234')).toBe('9233331234')
    expect(R.normalizarTelefone('')).toBeUndefined()
    expect(() => R.normalizarTelefone('9999')).toThrow(/DDD/)
  })

  it('resume o dia, a semana e o mês', () => {
    preparar()
    reservar(livre('10:00'))
    const ag = reservar(livre('11:30'), barbeiro, 'srv-003')
    avancar(5 * 60)
    db = R.encerrarAtendimento(db, ag.id, barbeiro, 'Finalizado')
    const r = R.resumoBarbeiro(db, 'prof-001')
    expect(r).toMatchObject({ hoje: 2, previstoHoje: 140, faturadoMes: 85, atendidosMes: 1, pendentes: 1 })
  })
})

describe('assinatura e parceria', () => {
  it('a Procópio começa em teste grátis e aparece no catálogo', () => {
    const a = R.assinaturaDe(db, 'bb001')
    expect(R.situacaoAssinatura(a)).toBe('Teste')
    expect(R.barbeariaVisivel(db.barbearias.find((b) => b.id === 'bb001')!)).toBe(true)
  })

  it('assinatura vencida tira a barbearia da busca e bloqueia reservas (RN08)', () => {
    preparar()
    avancar(31 * 24 * 60)
    expect(R.situacaoAssinatura(R.assinaturaDe(db, 'bb001'))).toBe('Vencida')
    expect(R.barbeariaVisivel(db.barbearias.find((b) => b.id === 'bb001')!)).toBe(false)
    const dia = new Date(agora)
    const d = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate() + 1).padStart(2, '0')}`
    preparar(d)
    expect(() => reservar(livre('10:00', d))).toThrow(/não está recebendo reservas/)
  })

  it('não deixa escolher plano menor que a equipe', () => {
    expect(() => R.escolherPlano(db, barbeiro, 'basico')).toThrow(/permite até 2/)
  })

  it('no teste só troca o plano; fora dele fica aguardando pagamento', () => {
    let r = R.escolherPlano(db, barbeiro, 'premium')
    expect(r.assinatura.status).toBe('Teste')
    avancar(31 * 24 * 60)
    r = R.escolherPlano(r.db, barbeiro, 'profissional')
    expect(r.assinatura.status).toBe('Pendente')
    const pago = R.confirmarPagamento(r.db, 'bb001')
    expect(R.situacaoAssinatura(R.assinaturaDe(pago, 'bb001'))).toBe('Ativa')
    expect(R.barbeariaVisivel(pago.barbearias.find((b) => b.id === 'bb001')!)).toBe(true)
  })

  it('cliente não escolhe plano nem pede parceria', () => {
    expect(() => R.escolherPlano(db, cliente, 'premium')).toThrow()
    expect(() => R.solicitarParceria(db, cliente, 10, 30)).toThrow()
  })

  it('a Procópio de demonstração é parceira com 15%', () => {
    expect(R.parceriaVigente(criarSeed(AGORA), 'bb001')?.descontoPct).toBe(15)
  })

  it('parceria só dá desconto depois de aprovada, e a reserva guarda o preço com desconto', () => {
    preparar()
    const r = R.solicitarParceria(db, barbeiro, 20, 30)
    db = r.db
    expect(R.parceriaVigente(db, 'bb001')).toBeUndefined()
    expect(() => R.solicitarParceria(db, barbeiro, 10, 30)).toThrow(/ativa ou em análise/)
    db = R.aprovarParceria(db, r.parceria.id)
    const srv = db.servicos.find((s) => s.id === 'srv-001')!
    expect(R.precoNoApp(db, srv)).toEqual({ preco: Math.round(srv.preco * 80) / 100, original: srv.preco, descontoPct: 20 })
    const ag = reservar(livre('10:00'))
    expect(ag.precoReservado).toBe(Math.round(srv.preco * 80) / 100)
  })

  it('encerrar a parceria acaba com o destaque na hora (RN09)', () => {
    const r = R.solicitarParceria(db, barbeiro, 15, 90)
    db = R.aprovarParceria(r.db, r.parceria.id)
    avancar(60)
    db = R.encerrarParceria(db, barbeiro, r.parceria.id)
    expect(R.parceriaVigente(db, 'bb001')).toBeUndefined()
    expect(R.precoNoApp(db, db.servicos[0]).original).toBeUndefined()
  })

  it('desconto fora da lista é recusado', () => {
    expect(() => R.solicitarParceria(db, barbeiro, 50, 30)).toThrow(/entre 10% e 30%/)
  })
})
