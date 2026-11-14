import type { Banco, OpcaoDistancia } from '../domain/types'

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

export function criarSeed(): Banco {
  return {
    versao: 1,
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
  }
}
