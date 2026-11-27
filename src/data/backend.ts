// Contrato entre as telas e a fonte de dados. Dois modos:
// - local: localStorage, contas de demonstração, regras em src/domain/rules.ts
// - supabase: Postgres com RLS, login por e-mail e regras em funções SQL atômicas
// O modo é escolhido pelas variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.

import type { Agendamento, Assinatura, Banco, Jornada, Parceria, Servico, Usuario } from '../domain/types'
import type { DadosBarbearia, ServicoEditavel } from '../domain/rules'

export type Estado = {
  db: Banco
  email: string | null
  pronto: boolean
  /** Falha ao carregar do servidor (sem internet, servidor fora). */
  erro?: string
}

export interface Backend {
  modo: 'local' | 'supabase'
  /** Carrega e passa a notificar mudanças. Retorna a função para parar. */
  iniciar(onChange: (e: Estado) => void): () => void
  /** Tenta carregar de novo depois de uma falha. */
  recarregar(): Promise<void>
  /** local: entra direto. supabase: envia link/código por e-mail. */
  entrar(email: string): Promise<'entrou' | 'codigo_enviado'>
  verificarCodigo(email: string, codigo: string): Promise<void>
  sair(): Promise<void>
  atualizarUsuario(patch: Partial<Usuario>): Promise<void>
  prepararHorarios(profissionalId: string, dia: string): Promise<void>
  confirmar(horarioId: string, servicoId: string): Promise<Agendamento>
  remarcar(agendamentoId: string, novoHorarioId: string): Promise<Agendamento>
  cancelar(agendamentoId: string): Promise<void>
  encerrar(agendamentoId: string, resultado: 'Finalizado' | 'Não compareceu'): Promise<void>
  alternarBloqueio(horarioId: string): Promise<void>
  salvarJornada(jornada: Jornada): Promise<void>
  salvarServico(servico: ServicoEditavel): Promise<Servico>
  atualizarBarbearia(dados: DadosBarbearia): Promise<void>
  avaliar(agendamentoId: string, nota: number, comentario: string): Promise<void>
  atualizarFotoBarbearia(barbeariaId: string, foto: string | undefined): Promise<void>
  /** Guarda uma imagem (data URL já reduzida) e devolve o endereço para usar no app. */
  subirImagem(pasta: 'barbearias' | 'perfis', dataUrl: string): Promise<string>
  /** Assinatura da unidade do barbeiro (RF15/RF16). */
  escolherPlano(planoId: string): Promise<Assinatura>
  cancelarAssinatura(): Promise<void>
  /** Parceria da unidade do barbeiro (RF17). */
  solicitarParceria(descontoPct: number, dias: number): Promise<Parceria>
  encerrarParceria(parceriaId: string): Promise<void>
  /** Só no modo demonstração: aprova o pedido de parceria e confirma o pagamento pendente. */
  simularEquipe?(): Promise<void>
  resetar?(): Promise<void>
}
