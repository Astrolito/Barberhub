// Contrato entre as telas e a fonte de dados. Dois modos:
// - local: localStorage, contas de demonstração, regras em src/domain/rules.ts
// - supabase: Postgres com RLS, login por e-mail e regras em funções SQL atômicas
// O modo é escolhido pelas variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.

import type { Agendamento, Banco, Usuario } from '../domain/types'

export type Estado = { db: Banco; email: string | null; pronto: boolean }

export interface Backend {
  modo: 'local' | 'supabase'
  /** Carrega e passa a notificar mudanças. Retorna a função para parar. */
  iniciar(onChange: (e: Estado) => void): () => void
  /** local: entra direto. supabase: envia link/código por e-mail. */
  entrar(email: string): Promise<'entrou' | 'codigo_enviado'>
  verificarCodigo(email: string, codigo: string): Promise<void>
  sair(): Promise<void>
  atualizarUsuario(patch: Partial<Usuario>): Promise<void>
  prepararHorarios(profissionalId: string, dia: string): Promise<void>
  confirmar(horarioId: string, servicoId: string): Promise<Agendamento>
  cancelar(agendamentoId: string): Promise<void>
  finalizar(agendamentoId: string): Promise<void>
  alternarBloqueio(horarioId: string): Promise<void>
  atualizarFotoBarbearia(barbeariaId: string, foto: string | undefined): Promise<void>
  resetar?(): Promise<void>
}
