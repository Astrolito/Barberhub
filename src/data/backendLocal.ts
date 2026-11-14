import type { Banco, Usuario } from '../domain/types'
import * as R from '../domain/rules'
import { RepositorioLocal } from './repository'
import type { Backend, Estado } from './backend'

const SESSAO = 'barberhub:sessao'

function ler(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
function gravar(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* modo privado */
  }
}

/** Modo demonstração: tudo no aparelho, regras de negócio em TypeScript. */
export function criarBackendLocal(): Backend {
  const repo = new RepositorioLocal()
  let db: Banco = repo.carregar()
  let email = ler(SESSAO)
  let ouvinte: ((e: Estado) => void) | null = null

  const emitir = () => ouvinte?.({ db, email, pronto: true })
  const commit = (next: Banco) => {
    db = next
    repo.salvar(db)
    emitir()
  }
  const eu = (): Usuario => {
    const u = db.usuarios.find((x) => x.email === email)
    if (!u) throw new R.RegraError('Entre na sua conta para continuar.')
    return u
  }

  return {
    modo: 'local',
    iniciar(cb) {
      ouvinte = cb
      emitir()
      return () => (ouvinte = null)
    },
    async entrar(e) {
      const alvo = e.trim().toLowerCase()
      if (!db.usuarios.some((x) => x.email === alvo)) throw new R.RegraError('Conta não encontrada. Use uma das contas de demonstração.')
      email = alvo
      gravar(SESSAO, alvo)
      emitir()
      return 'entrou'
    },
    async verificarCodigo() {},
    async sair() {
      email = null
      gravar(SESSAO, null)
      emitir()
    },
    async atualizarUsuario(patch) {
      const u = eu()
      commit({ ...db, usuarios: db.usuarios.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) })
    },
    async prepararHorarios(p, d) {
      commit(R.prepararHorarios(db, p, d))
    },
    async confirmar(h, s) {
      const r = R.confirmarAgendamento(db, { clienteEmail: eu().email, horarioId: h, servicoId: s })
      commit(r.db)
      return r.agendamento
    },
    async cancelar(id) {
      commit(R.cancelarAgendamento(db, id, eu()))
    },
    async finalizar(id) {
      commit(R.finalizarAtendimento(db, id, eu()))
    },
    async alternarBloqueio(id) {
      commit(R.alternarBloqueio(db, id, eu()))
    },
    async atualizarFotoBarbearia(id, foto) {
      const u = eu()
      if (u.papel !== 'Barbeiro' || u.barbeariaId !== id) throw new R.RegraError('Apenas o barbeiro vinculado pode alterar a foto.')
      commit({ ...db, barbearias: db.barbearias.map((b) => (b.id === id ? { ...b, fotoCapa: foto } : b)) })
    },
    async resetar() {
      commit(repo.resetar())
    },
  }
}
