import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Agendamento, Banco, Jornada, Servico, Usuario } from '../domain/types'
import type { DadosBarbearia, ServicoEditavel } from '../domain/rules'
import type { Backend, Estado } from '../data/backend'
import { criarBackendLocal } from '../data/backendLocal'
import { criarBackendSupabase } from '../data/backendSupabase'
import { sincronizarLembretes } from '../lib/lembretes'

type Toast = { id: number; tipo: 'ok' | 'erro' | 'info'; texto: string }

interface Ctx {
  modo: Backend['modo']
  pronto: boolean
  /** Falha ao carregar os dados (sem conexão). */
  erro?: string
  recarregar(): Promise<void>
  db: Banco
  usuario: Usuario | null
  entrar(email: string): Promise<'entrou' | 'codigo_enviado' | null>
  verificarCodigo(email: string, codigo: string): Promise<boolean>
  sair(): Promise<void>
  /** true quando salvou. */
  atualizarUsuario(patch: Partial<Usuario>): Promise<boolean>
  alternarFavorito(barbeariaId: string): Promise<void>
  prepararHorarios(profissionalId: string, dia: string): Promise<void>
  confirmar(horarioId: string, servicoId: string): Promise<Agendamento | null>
  remarcar(agendamentoId: string, novoHorarioId: string): Promise<Agendamento | null>
  cancelar(agendamentoId: string): Promise<boolean>
  encerrar(agendamentoId: string, resultado: 'Finalizado' | 'Não compareceu'): Promise<boolean>
  alternarBloqueio(horarioId: string): Promise<void>
  salvarJornada(jornada: Jornada): Promise<boolean>
  salvarServico(servico: ServicoEditavel): Promise<Servico | null>
  atualizarBarbearia(dados: DadosBarbearia): Promise<boolean>
  avaliar(agendamentoId: string, nota: number, comentario: string): Promise<boolean>
  /** foto: data URL nova (é enviada ao armazenamento) ou undefined para remover. */
  atualizarFotoBarbearia(barbeariaId: string, foto: string | undefined): Promise<void>
  resetarDados?: () => Promise<void>
  toasts: Toast[]
  toast(texto: string, tipo?: Toast['tipo']): void
}

const AppCtx = createContext<Ctx | null>(null)

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined
const CHAVE_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const backend: Backend = URL_SB && CHAVE_SB ? criarBackendSupabase(URL_SB, CHAVE_SB) : criarBackendLocal()

const vazio: Banco = { versao: 2, usuarios: [], barbearias: [], profissionais: [], servicos: [], horarios: [], agendamentos: [], avaliacoes: [] }

export function AppProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>({ db: vazio, email: null, pronto: false })
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)

  useEffect(() => backend.iniciar(setEstado), [])

  const toast = useCallback((texto: string, tipo: Toast['tipo'] = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, tipo, texto }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
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
  const ok = async (p: Promise<unknown>) => (await p) !== null

  const usuario = useMemo(() => estado.db.usuarios.find((u) => u.email === estado.email) ?? null, [estado])

  // Lembretes no app instalado: 1h antes de cada reserva confirmada do cliente.
  useEffect(() => {
    if (usuario) sincronizarLembretes(estado.db, usuario.email)
  }, [estado.db, usuario])

  const subirSeNovo = (pasta: 'barbearias' | 'perfis', foto: string | undefined) =>
    foto?.startsWith('data:') ? backend.subirImagem(pasta, foto) : Promise.resolve(foto)

  const value: Ctx = {
    modo: backend.modo,
    pronto: estado.pronto,
    erro: estado.erro,
    recarregar: async () => {
      await tentar(() => backend.recarregar())
    },
    db: estado.db,
    usuario,
    toasts,
    toast,
    entrar: (email) => tentar(() => backend.entrar(email)),
    verificarCodigo: async (email, codigo) => (await tentar(() => backend.verificarCodigo(email, codigo).then(() => true))) ?? false,
    sair: async () => {
      await tentar(() => backend.sair())
    },
    atualizarUsuario: (patch) =>
      ok(
        tentar(async () => {
          const p = { ...patch }
          if ('foto' in p) p.foto = await subirSeNovo('perfis', p.foto)
          await backend.atualizarUsuario(p)
          return true
        }),
      ),
    alternarFavorito: async (id) => {
      if (!usuario) return
      const favoritos = usuario.favoritos.includes(id) ? usuario.favoritos.filter((x) => x !== id) : [...usuario.favoritos, id]
      await tentar(() => backend.atualizarUsuario({ favoritos }))
    },
    prepararHorarios: async (p, d) => {
      await tentar(() => backend.prepararHorarios(p, d))
    },
    confirmar: (h, s) => tentar(() => backend.confirmar(h, s), 'Agendamento confirmado!'),
    remarcar: (id, h) => tentar(() => backend.remarcar(id, h), 'Reserva remarcada.'),
    cancelar: (id) => ok(tentar(() => backend.cancelar(id).then(() => true), 'Agendamento cancelado. O horário foi liberado.', 'info')),
    encerrar: (id, r) =>
      ok(tentar(() => backend.encerrar(id, r).then(() => true), r === 'Finalizado' ? 'Atendimento finalizado.' : 'Falta registrada.', r === 'Finalizado' ? 'ok' : 'info')),
    alternarBloqueio: async (id) => {
      await tentar(() => backend.alternarBloqueio(id))
    },
    salvarJornada: (j) => ok(tentar(() => backend.salvarJornada(j).then(() => true), 'Agenda salva. Os novos horários já aparecem para os clientes.')),
    salvarServico: (s) => tentar(() => backend.salvarServico(s), s.id ? 'Serviço atualizado.' : 'Serviço criado.'),
    atualizarBarbearia: (d) => ok(tentar(() => backend.atualizarBarbearia(d).then(() => true), 'Dados da unidade salvos.')),
    avaliar: (id, n, c) => ok(tentar(() => backend.avaliar(id, n, c).then(() => true), 'Obrigado pela avaliação!')),
    atualizarFotoBarbearia: async (id, foto) => {
      await tentar(async () => backend.atualizarFotoBarbearia(id, await subirSeNovo('barbearias', foto)), foto ? 'Foto atualizada.' : 'Foto removida.')
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
