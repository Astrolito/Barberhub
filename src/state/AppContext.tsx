import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Agendamento, Banco, Usuario } from '../domain/types'
import type { Backend, Estado } from '../data/backend'
import { criarBackendLocal } from '../data/backendLocal'
import { criarBackendSupabase } from '../data/backendSupabase'

type Toast = { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string }

interface Ctx {
  modo: Backend['modo']
  pronto: boolean
  db: Banco
  usuario: Usuario | null
  entrar(email: string): Promise<'entrou' | 'codigo_enviado' | null>
  verificarCodigo(email: string, codigo: string): Promise<boolean>
  sair(): Promise<void>
  atualizarUsuario(patch: Partial<Usuario>): Promise<void>
  alternarFavorito(barbeariaId: string): Promise<void>
  prepararHorarios(profissionalId: string, dia: string): Promise<void>
  confirmar(horarioId: string, servicoId: string): Promise<Agendamento | null>
  cancelar(agendamentoId: string): Promise<void>
  finalizar(agendamentoId: string): Promise<void>
  alternarBloqueio(horarioId: string): Promise<void>
  atualizarFotoBarbearia(barbeariaId: string, foto: string | undefined): Promise<void>
  resetarDados?: () => Promise<void>
  toasts: Toast[]
  toast(texto: string, tipo?: Toast['tipo']): void
}

const AppCtx = createContext<Ctx | null>(null)

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const backend: Backend = URL_SB && CHAVE_SB ? criarBackendSupabase(URL_SB, CHAVE_SB) : criarBackendLocal()

export function AppProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({
    db: { versao: 1, usuarios: [], barbearias: [], profissionais: [], servicos: [], horarios: [], agendamentos: [] },
    email: null,
    pronto: false,
  })
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  useEffect(() => backend.iniciar(setEstado), [])

  const toast = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, tipo, texto }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const tentar = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string, tipo: Toast['tipo'] = 'ok'): Promise<T | null> => {
      try {
        const r = await fn()
        if (ok) toast(ok, tipo)
        return r
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Algo deu errado.', 'erro')
        return null
      }
    },
    [toast],
  )

  const usuario = useMemo(() => estado.db.usuarios.find((u) => u.email === estado.email) ?? null, [estado])

  const value: Ctx = {
    modo: backend.modo,
    pronto: estado.pronto,
    db: estado.db,
    usuario,
    toasts,
    toast,
    entrar: (email) => tentar(() => backend.entrar(email)),
    verificarCodigo: async (email, codigo) => (await tentar(() => backend.verificarCodigo(email, codigo).then(() => true))) ?? false,
    sair: async () => {
      await tentar(() => backend.sair())
    },
    atualizarUsuario: async (patch) => {
      await tentar(() => backend.atualizarUsuario(patch))
    },
    alternarFavorito: async (id) => {
      if (!usuario) return
      const favoritos = usuario.favoritos.includes(id) ? usuario.favoritos.filter((x) => x !== id) : [...usuario.favoritos, id]
      await tentar(() => backend.atualizarUsuario({ favoritos }))
    },
    prepararHorarios: async (p, d) => {
      await tentar(() => backend.prepararHorarios(p, d))
    },
    confirmar: async (h, s) => {
      const ag = await tentar(() => backend.confirmar(h, s))
      if (ag?.status === 'Confirmado') toast('Agendamento confirmado!')
      else if (ag) toast('Esse horário acabou de ficar indisponível. Escolha outro.', 'erro')
      return ag
    },
    cancelar: async (id) => {
      await tentar(() => backend.cancelar(id), 'Agendamento cancelado. O horário foi liberado.', 'info')
    },
    finalizar: async (id) => {
      await tentar(() => backend.finalizar(id), 'Atendimento finalizado.')
    },
    alternarBloqueio: async (id) => {
      await tentar(() => backend.alternarBloqueio(id))
    },
    atualizarFotoBarbearia: async (id, foto) => {
      await tentar(() => backend.atualizarFotoBarbearia(id, foto), foto ? 'Foto atualizada.' : 'Foto removida.')
    },
    resetarDados: backend.resetar
      ? async () => {
          await tentar(() => backend.resetar!(), 'Dados de demonstração restaurados.', 'info')
        }
      : undefined,
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fora do AppProvider')
  return c
}

/** Para telas que exigem login (garantido pelo guard de rotas). */
export function useUsuario() {
  const { usuario } = useApp()
  if (!usuario) throw new Error('Usuário ausente')
  return usuario
}
