import type { Assinatura, Banco, OpcaoDistancia, Parceria, Plano } from '../domain/types'

// Catálogo de Manaus (doc v1.4, seção 3.2). Coordenadas aproximadas pelo bairro/
// endereço público; serviços, profissionais e horários são massa acadêmica.
// Somente a Procópio (bb001) concentra a jornada completa.

export const OPCOES_DISTANCIA: OpcaoDistancia[] = [
  { nome: 'Até 1 km', limiteKm: 1 },
  { nome: 'Até 3 km', limiteKm: 3 },
  { nome: 'Até 5 km', limiteKm: 5 },
  { nome: 'Até 10 km', limiteKm: 10 },
  { nome: 'Até 20 km', limiteKm: 20 },
  { nome: 'Sem limite', limiteKm: 0 },
]

export const RAIO_PADRAO_KM = 5

export const DEMO_CLIENTE_EMAIL = 'cliente@barberhub.app'
export const DEMO_BARBEIRO_EMAIL = 'barbeiro@barberhub.app'

/** Planos de assinatura (iguais aos da migração 20261127000000_assinaturas_parcerias.sql). */
export const PLANOS: Plano[] = [
  { id: 'basico', nome: 'Básico', precoMensal: 49.9, maxProfissionais: 2, descricao: 'Para quem está começando: agenda online para até 2 barbeiros.', ordem: 1 },
  { id: 'profissional', nome: 'Profissional', precoMensal: 89.9, maxProfissionais: 5, descricao: 'Para barbearias em crescimento: até 5 barbeiros.', ordem: 2 },
  { id: 'premium', nome: 'Premium', precoMensal: 149.9, maxProfissionais: 0, descricao: 'Barbeiros ilimitados, para redes e unidades grandes.', ordem: 3 },
]

const DIA_MS = 864e5

export function criarSeed(agora = Date.now()): Banco {
  const db = criarCatalogo()
  const receita = receitaInicial(db.barbearias.map((b) => b.id), agora)
  const ate = new Map(receita.assinaturas.map((a) => [a.barbeariaId, a.validaAte]))
  return { ...db, ...receita, barbearias: db.barbearias.map((b) => ({ ...b, visivelAte: ate.get(b.id) })) }
}

/**
 * Assinaturas e parcerias de demonstração: a Procópio (unidade do barbeiro de teste) em teste grátis,
 * as demais com o plano Profissional ativo; Barões (20%) e a própria Procópio (15%) como parceiras.
 */
export function receitaInicial(ids: string[], agora = Date.now()) {
  const iso = (ms: number) => new Date(ms).toISOString()
  const assinaturas: Assinatura[] = ids.map((id) => ({
    id,
    barbeariaId: id,
    planoId: 'profissional',
    status: id === 'bb001' ? 'Teste' : 'Ativa',
    inicio: iso(agora),
    validaAte: iso(agora + (id === 'bb001' ? 30 : 365) * DIA_MS),
    atualizadoEm: iso(agora),
  }))
  const parcerias: Parceria[] = [
    ['bb003', 20],
    ['bb001', 15],
  ]
    .filter(([id]) => ids.includes(id as string))
    .map(([id, pct]) => ({
      id: `parc-${id}`,
      barbeariaId: id as string,
      descontoPct: pct as number,
      dias: 90,
      status: 'Ativa',
      inicio: iso(agora),
      fim: iso(agora + 90 * DIA_MS),
      criadoEm: iso(agora),
    }))
  return { planos: PLANOS, assinaturas, parcerias }
}

function criarCatalogo(): Banco {
  return {
    versao: 3,
    usuarios: [
      {
        id: 'u-cliente',
        email: DEMO_CLIENTE_EMAIL,
        nome: 'Renatto',
        papel: 'Cliente',
        favoritos: [],
      },
      {
        id: 'u-barbeiro',
        email: DEMO_BARBEIRO_EMAIL,
        nome: 'Renatto Gabriel',
        papel: 'Barbeiro',
        profissionalId: 'prof-001',
        barbeariaId: 'bb001',
        favoritos: [],
      },
    ],
    barbearias: [
      {
        id: 'bb001',
        nome: 'Barbearia Procópio — Manauara Shopping',
        endereco: 'Av. Mário Ypiranga, 1300 — Manauara Shopping, piso G6 — Adrianópolis, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Adrianópolis',
        descricao: 'Unidade Manauara Shopping, piso G6.',
        lat: -3.10443,
        lng: -60.01198,
        marca: { sigla: 'PROCÓPIO', cor: '#ffffff', fundo: '#000000', fonte: 'serif' },
      },
      {
        id: 'bb002',
        nome: 'DOManuell Barbearia',
        endereco: 'Santa Etelvina, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Santa Etelvina',
        descricao: 'Barbearia tradicional na Zona Norte.',
        lat: -2.99419,
        lng: -60.01526,
        marca: { sigla: 'DOManuell', cor: '#d4a64a', fundo: '#000000', fonte: 'script' },
      },
      {
        id: 'bb003',
        nome: 'Barões Barber Shop — Compensa 1',
        endereco: 'Compensa, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Compensa',
        descricao: 'Barber shop desde 2020.',
        lat: -3.10822,
        lng: -60.05667,
        marca: { sigla: 'Barões', cor: '#c9a46a', fundo: '#1a1715', fonte: 'serif' },
      },
      {
        id: 'bb004',
        nome: 'FB Federal Barbearia',
        endereco: 'Tancredo Neves, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Tancredo Neves',
        descricao: 'Barbearia na Zona Leste.',
        lat: -3.05638,
        lng: -59.96617,
        marca: { sigla: 'FB', cor: '#ffffff', fundo: '#000000', fonte: 'serif' },
      },
      {
        id: 'bb005',
        nome: 'Barbearia Jeejus — Vieiralves',
        endereco: 'Vieiralves, Nossa Senhora das Graças, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Vieiralves',
        descricao: 'Unidade Vieiralves.',
        lat: -3.10355,
        lng: -60.02153,
        marca: { sigla: 'JE&JUS', cor: '#f59e0b', fundo: '#000000', fonte: 'sans' },
      },
      {
        id: 'bb006',
        nome: 'Soul Barbearia — Manauara Shopping',
        endereco: 'Av. Mário Ypiranga, 1300 — Manauara Shopping — Adrianópolis, Manaus - AM',
        cidade: 'Manaus',
        bairro: 'Adrianópolis',
        descricao: 'Unidade Manauara Shopping.',
        lat: -3.10443,
        lng: -60.01198,
        marca: { sigla: 'SOUL', cor: '#d4e157', fundo: '#2a2a2a', fonte: 'sans' },
      },
    ],
    profissionais: [
      {
        id: 'prof-001',
        nome: 'Renatto Gabriel',
        descricao: 'Atendimento com horário marcado.',
        especialidades: 'Corte, barba, corte + barba e pezinho',
        barbeariaId: 'bb001',
        emailAcesso: DEMO_BARBEIRO_EMAIL,
      },
      {
        id: 'prof-002',
        nome: 'Yan Félix',
        descricao: 'Atendimento com horário marcado.',
        especialidades: 'Corte, barba, corte + barba e pezinho',
        barbeariaId: 'bb001',
      },
      {
        id: 'prof-003',
        nome: 'Nicolas Duarte',
        descricao: 'Atendimento com horário marcado.',
        especialidades: 'Corte, barba, corte + barba e pezinho',
        barbeariaId: 'bb001',
      },
      {
        id: 'prof-004',
        nome: 'Sávio Santos',
        descricao: 'Atendimento com horário marcado.',
        especialidades: 'Corte, barba, corte + barba e pezinho',
        barbeariaId: 'bb001',
      },
    ],
    servicos: [
      {
        id: 'srv-001',
        barbeariaId: 'bb001',
        nome: 'Corte masculino',
        descricao: 'Corte masculino com acabamento.',
        preco: 55,
        duracaoMinutos: 40,
        categoria: 'Corte de cabelo',
        inclui: 'Shampoo, finalizador',
        disponivel: true,
        icone: 'corte',
      },
      {
        id: 'srv-002',
        barbeariaId: 'bb001',
        nome: 'Barba',
        descricao: 'Aparo e acabamento de barba.',
        preco: 40,
        duracaoMinutos: 30,
        categoria: 'Barba',
        inclui: 'Toalha quente, balm',
        disponivel: true,
        icone: 'barba',
      },
      {
        id: 'srv-003',
        barbeariaId: 'bb001',
        nome: 'Corte + Barba',
        descricao: 'Corte masculino e barba no mesmo atendimento.',
        preco: 85,
        duracaoMinutos: 70,
        categoria: 'Combo',
        inclui: 'Shampoo, toalha quente, finalizador',
        disponivel: true,
        icone: 'combo',
      },
      {
        id: 'srv-004',
        barbeariaId: 'bb001',
        nome: 'Pezinho',
        descricao: 'Acabamento dos contornos do cabelo.',
        preco: 20,
        duracaoMinutos: 15,
        categoria: 'Acabamento',
        inclui: 'Contorno com máquina',
        disponivel: true,
        icone: 'pezinho',
      },
    ],
    horarios: [],
    agendamentos: [],
    avaliacoes: [],
    planos: [],
    assinaturas: [],
    parcerias: [],
  }
}
