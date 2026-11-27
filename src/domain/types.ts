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
  /** Contato público, preenchido pelo barbeiro vinculado. */
  telefone?: string
  whatsapp?: string
  /** Até quando aparece no catálogo e recebe reservas (assinatura em dia, RN08). */
  visivelAte?: string
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
  /** Dias e horários em que atende. Vazio = jornada padrão. */
  jornada?: Jornada
}

/** Agenda configurável do profissional. */
export interface Jornada {
  /** Dias da semana atendidos (0 = domingo … 6 = sábado). */
  dias: number[]
  /** Primeiro horário do dia, "HH:MM". */
  inicio: string
  /** Hora em que o último atendimento precisa terminar, "HH:MM". */
  fim: string
  /** Duração de cada intervalo reservável, em minutos. */
  intervaloMin: number
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

// 'Indisponível' fica só por compatibilidade com dados antigos: tentativas recusadas não são mais gravadas.
export type StatusAgendamento = 'Confirmado' | 'Indisponível' | 'Cancelado' | 'Finalizado' | 'Não compareceu'

export interface Agendamento {
  id: string
  protocolo: string
  barbeariaId: string
  servicoId: string
  profissionalId: string
  horarioId: string
  clienteEmail: string
  /** Nome do cliente no momento da reserva (o barbeiro não lê o perfil do cliente). */
  clienteNome?: string
  inicio: string
  fim: string
  status: StatusAgendamento
  precoReservado?: number
  duracaoReservada?: number
  criadoEm: string
  atualizadoEm: string
}

export interface Avaliacao {
  id: string
  agendamentoId: string
  barbeariaId: string
  profissionalId: string
  /** Primeiro nome de quem avaliou. */
  clienteNome: string
  nota: number
  comentario: string
  criadoEm: string
}

// ───────────── Modelo de receita (27/11/2026) ─────────────

export interface Plano {
  id: string
  nome: string
  precoMensal: number
  /** 0 = sem limite. */
  maxProfissionais: number
  descricao: string
  ordem: number
}

/** Gravado no banco. "Vencida" é calculada a partir de validaAte. */
export type StatusAssinatura = 'Teste' | 'Ativa' | 'Pendente' | 'Cancelada'

export interface Assinatura {
  /** Igual ao barbeariaId (uma assinatura por barbearia). */
  id: string
  barbeariaId: string
  planoId: string
  status: StatusAssinatura
  inicio: string
  validaAte: string
  atualizadoEm: string
}

export type StatusParceria = 'Solicitada' | 'Ativa' | 'Recusada' | 'Cancelada' | 'Encerrada'

/** Parceria com a plataforma: preço diferenciado pelo app em troca de destaque. */
export interface Parceria {
  id: string
  barbeariaId: string
  /** Desconto em todos os serviços agendados pelo app. */
  descontoPct: number
  dias: number
  status: StatusParceria
  inicio?: string
  fim?: string
  criadoEm: string
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
  avaliacoes: Avaliacao[]
  planos: Plano[]
  /** No modo Supabase, só a da unidade do barbeiro logado. */
  assinaturas: Assinatura[]
  /** Em vigor (públicas) + as da unidade do barbeiro logado. */
  parcerias: Parceria[]
}
