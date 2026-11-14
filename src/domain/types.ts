// Modelo lógico do BarberHUB (UML 06/10/2026, doc técnica v1.4).
// Seis entidades centrais + tabela auxiliar de distância.

export type Papel = 'Cliente' | 'Barbeiro'

export interface Usuario {
  id: string
  email: string
  nome: string
  foto?: string
  papel: Papel
  /** Vínculo opcional: profissional da conta autorizada. */
  profissionalId?: string
  /** Vínculo opcional: unidade que o profissional pode atualizar. */
  barbeariaId?: string
  /** Ponto de busca salvo (GPS ou endereço). */
  localizacao?: PontoBusca
  /** Preferência individual de raio. 0 = sem limite. Vazio = 5 km. */
  raioBuscaKm?: number
  /** Favoritos por usuário (no Glide era um Boolean user-specific). */
  favoritos: string[]
  /** Data escolhida na busca de horários, por profissional (user-specific). */
  dataBusca?: Record<string, string>
}

export interface PontoBusca {
  lat: number
  lng: number
  origem: 'gps' | 'endereco' | 'bairro'
  rotulo: string
}

export interface Barbearia {
  id: string
  nome: string
  endereco: string
  cidade: string
  bairro: string
  descricao: string
  lat: number
  lng: number
  /** Foto enviada pelo barbeiro vinculado (data URL). */
  fotoCapa?: string
  /** Identidade visual de espera quando não há foto. */
  marca: { sigla: string; cor: string; fundo: string; fonte?: 'serif' | 'sans' | 'script' }
}

export interface Profissional {
  id: string
  nome: string
  descricao: string
  especialidades: string
  barbeariaId: string
  emailAcesso?: string
  foto?: string
}

export type IconeServico = 'corte' | 'barba' | 'combo' | 'pezinho'

export interface Servico {
  id: string
  barbeariaId: string
  nome: string
  descricao: string
  preco: number
  duracaoMinutos: number
  categoria: string
  inclui: string
  disponivel: boolean
  icone: IconeServico
}

export type StatusHorario = 'Livre' | 'Ocupado' | 'Bloqueado'

export interface Horario {
  id: string
  profissionalId: string
  barbeariaId: string
  inicio: string // ISO
  fim: string // ISO
  status: StatusHorario
}

export type StatusAgendamento = 'Confirmado' | 'Indisponível' | 'Cancelado' | 'Finalizado'

export interface Agendamento {
  id: string
  protocolo: string
  barbeariaId: string
  servicoId: string
  profissionalId: string
  horarioId: string
  clienteEmail: string
  barbeiroEmail?: string
  inicio: string
  fim: string
  status: StatusAgendamento
  precoReservado?: number
  duracaoReservada?: number
  criadoEm: string
  atualizadoEm: string
}

export interface OpcaoDistancia {
  nome: string
  limiteKm: number
}

export interface Banco {
  versao: number
  usuarios: Usuario[]
  barbearias: Barbearia[]
  profissionais: Profissional[]
  servicos: Servico[]
  horarios: Horario[]
  agendamentos: Agendamento[]
}
