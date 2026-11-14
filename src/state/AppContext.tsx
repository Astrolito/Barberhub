import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Agendamento, Banco, Usuario } from '../domain/types'
import { RepositorioLocal } from '../data/repository'
import * as R from '../domain/rules'

type Toast = { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string }

interface Ctx {
  db: Banco
  usuario: Usuario | null
  entrar(email: string): boolean
  sair(): void
  atualizarUsuario(patch: Partial<Usuario>): void
  alternarFavorito(barbeariaId: string): boolean
  prepararHorarios(profissionalId: string, dia: string): void
  confirmar(horarioId: string, servicoId: string): Agendamento | null
  cancelar(agendamentoId: string): void
  finalizar(agendamentoId: string): void
  alternarBloqueio(horarioId: string): void
  atualizarFotoBarbearia(barbeariaId: string, foto: string | undefined): void
  resetarDados(): void
  toasts: Toast[]
  toast(texto: string, tipo?: Toast['tipo']): void
}

const AppCtx = createContext<Ctx | null>(null)
const repo = new RepositorioLocal()
const SESSAO = 'barberhub:sessao'

function lerSessao() {
  try {
    return localStorage.getItem(SESSAO)
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Banco>(() => repo.carregar())
  const [email, setEmail] = useState<string | null>(lerSessao)
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const dbRef = useRef(db)
  dbRef.current = db

  const usuario = useMemo(() => db.usuarios.find((u) => u.email === email) ?? null, [db, email])

  const commit = useCallback((next: Banco) => {
    dbRef.current = next
    repo.salvar(next)
    setDb(next)
  }, [])

  const toast = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, tipo, texto }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const tentar = useCallback(
    <T,>(fn: () => T): T | null => {
      try {
        return fn()
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Algo deu errado.', 'erro')
        return null
      }
    },
    [toast],
  )

  const exigirUsuario = () => {
    const u = dbRef.current.usuarios.find((x) => x.email === email)
    if (!u) throw new R.RegraError('Entre na sua conta para continuar.')
    return u
  }

  const value: Ctx = {
    db,
    usuario,
    toasts,
    toast,
    entrar(e) {
      const alvo = e.trim().toLowerCase()
      const u = dbRef.current.usuarios.find((x) => x.email === alvo)
      if (!u) {
        toast('Conta não encontrada. Use uma das contas de demonstração.', 'erro')
        return false
      }
      try {
        localStorage.setItem(SESSAO, u.email)
      } catch {
        /* ignore */
      }
      setEmail(u.email)
      return true
    },
    sair() {
      try {
        localStorage.removeItem(SESSAO)
      } catch {
        /* ignore */
      }
      setEmail(null)
    },
    atualizarUsuario(patch) {
      tentar(() => {
        const u = exigirUsuario()
        commit({ ...dbRef.current, usuarios: dbRef.current.usuarios.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) })
      })
    },
    alternarFavorito(id) {
      return (
        tentar(() => {
          const u = exigirUsuario()
          const fav = u.favoritos.includes(id)
          const favoritos = fav ? u.favoritos.filter((x) => x !== id) : [...u.favoritos, id]
          commit({ ...dbRef.current, usuarios: dbRef.current.usuarios.map((x) => (x.id === u.id ? { ...x, favoritos } : x)) })
          return !fav
        }) ?? false
      )
    },
    prepararHorarios(profissionalId, dia) {
      tentar(() => commit(R.prepararHorarios(dbRef.current, profissionalId, dia)))
    },
    confirmar(horarioId, servicoId) {
      return tentar(() => {
        const u = exigirUsuario()
        const { db: next, agendamento } = R.confirmarAgendamento(dbRef.current, { clienteEmail: u.email, horarioId, servicoId })
        commit(next)
        if (agendamento.status === 'Confirmado') toast('Agendamento confirmado!')
        else toast('Esse horário acabou de ficar indisponível. Escolha outro.', 'erro')
        return agendamento
      })
    },
    cancelar(id) {
      tentar(() => {
        commit(R.cancelarAgendamento(dbRef.current, id, exigirUsuario()))
        toast('Agendamento cancelado. O horário foi liberado.', 'info')
      })
    },
    finalizar(id) {
      tentar(() => {
        commit(R.finalizarAtendimento(dbRef.current, id, exigirUsuario()))
        toast('Atendimento finalizado.')
      })
    },
    alternarBloqueio(id) {
      tentar(() => commit(R.alternarBloqueio(dbRef.current, id, exigirUsuario())))
    },
    atualizarFotoBarbearia(barbeariaId, foto) {
      tentar(() => {
        const u = exigirUsuario()
        if (u.papel !== 'Barbeiro' || u.barbeariaId !== barbeariaId)
          throw new R.RegraError('Apenas o barbeiro vinculado pode alterar a foto.')
        commit({
          ...dbRef.current,
          barbearias: dbRef.current.barbearias.map((b) => (b.id === barbeariaId ? { ...b, fotoCapa: foto } : b)),
        })
        toast(foto ? 'Foto atualizada.' : 'Foto removida.')
      })
    },
    resetarDados() {
      commit(repo.resetar())
      toast('Dados de demonstração restaurados.', 'info')
    },
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
