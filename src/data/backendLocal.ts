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
    async recarregar() {
      emitir()
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
      const r = R.confirmarAgendamento(db, { cliente: eu(), horarioId: h, servicoId: s })
      commit(r.db)
      return r.agendamento
    },
    async remarcar(id, h) {
      const r = R.remarcarAgendamento(db, id, h, eu())
      commit(r.db)
      return r.agendamento
    },
    async cancelar(id) {
      commit(R.cancelarAgendamento(db, id, eu()))
    },
    async encerrar(id, resultado) {
      commit(R.encerrarAtendimento(db, id, eu(), resultado))
    },
    async alternarBloqueio(id) {
      commit(R.alternarBloqueio(db, id, eu()))
    },
    async salvarJornada(j) {
      commit(R.salvarJornada(db, eu(), j))
    },
    async salvarServico(s) {
      const r = R.salvarServico(db, eu(), s)
      commit(r.db)
      return r.servico
    },
    async atualizarBarbearia(dados) {
      commit(R.atualizarBarbearia(db, eu(), dados))
    },
    async avaliar(id, nota, comentario) {
      commit(R.avaliarAtendimento(db, id, eu(), nota, comentario))
    },
    async subirImagem(_pasta, dataUrl) {
      return dataUrl
    },
    async atualizarFotoBarbearia(id, foto) {
      const u = eu()
      if (u.papel !== 'Barbeiro' || u.barbeariaId !== id) throw new R.RegraError('Apenas o barbeiro vinculado pode alterar a foto.')
      commit({ ...db, barbearias: db.barbearias.map((b) => (b.id === id ? { ...b, fotoCapa: foto } : b)) })
    },
    async escolherPlano(planoId) {
      const r = R.escolherPlano(db, eu(), planoId)
      commit(r.db)
      return r.assinatura
    },
    async cancelarAssinatura() {
      commit(R.cancelarAssinatura(db, eu()))
    },
    async solicitarParceria(pct, dias) {
      const r = R.solicitarParceria(db, eu(), pct, dias)
      commit(r.db)
      return r.parceria
    },
    async encerrarParceria(id) {
      commit(R.encerrarParceria(db, eu(), id))
    },
    async simularEquipe() {
      const b = eu().barbeariaId
      if (!b) return
      let novo = db
      const pedido = novo.parcerias.find((p) => p.barbeariaId === b && p.status === 'Solicitada')
      if (pedido) novo = R.aprovarParceria(novo, pedido.id)
      const a = R.assinaturaDe(novo, b)
      if (a && (a.status === 'Pendente' || R.situacaoAssinatura(a) === 'Vencida')) novo = R.confirmarPagamento(novo, b)
      commit(novo)
    },
    async resetar() {
      commit(repo.resetar())
    },
  }
}
