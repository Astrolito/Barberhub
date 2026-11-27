// Camada de persistência. A interface isola o app do armazenamento:
// hoje é localStorage (funciona offline e dentro do webview); amanhã pode ser
// Supabase/Firebase/API própria sem mudar telas nem regras.

import type { Banco } from '../domain/types'
import { criarSeed, receitaInicial } from './seed'

export interface Repositorio {
  carregar(): Banco
  salvar(db: Banco): void
  resetar(): Banco
}

const CHAVE = 'barberhub:db:v1'

export class RepositorioLocal implements Repositorio {
  private memoria: Banco | null = null

  carregar(): Banco {
    try {
      const raw = localStorage.getItem(CHAVE)
      if (raw) {
        let db = JSON.parse(raw) as Banco
        if (db.versao === 3) return (this.memoria = db)
        // v1 → v2: avaliações, nome do cliente na reserva, sem tentativas "Indisponível".
        if (db.versao === 1) {
          const nomes = new Map(db.usuarios.map((u) => [u.email, u.nome]))
          const v2: Banco = {
            ...db,
            versao: 2,
            avaliacoes: [],
            agendamentos: db.agendamentos
              .filter((a) => a.status !== 'Indisponível')
              .map((a) => ({ ...a, clienteNome: a.clienteNome ?? nomes.get(a.clienteEmail) })),
          }
          db = v2
        }
        // v2 → v3: planos, assinaturas e parcerias.
        if (db.versao === 2) {
          const receita = receitaInicial(db.barbearias.map((b) => b.id))
          const ate = new Map(receita.assinaturas.map((a) => [a.barbeariaId, a.validaAte]))
          const v3: Banco = { ...db, ...receita, versao: 3, barbearias: db.barbearias.map((b) => ({ ...b, visivelAte: ate.get(b.id) })) }
          this.salvar(v3)
          return (this.memoria = v3)
        }
      }
    } catch {
      /* storage indisponível: segue em memória */
    }
    return (this.memoria = this.memoria ?? criarSeed())
  }

  salvar(db: Banco) {
    this.memoria = db
    try {
      localStorage.setItem(CHAVE, JSON.stringify(db))
    } catch {
      /* cota cheia ou modo privado */
    }
  }

  resetar(): Banco {
    const db = criarSeed()
    this.salvar(db)
    return db
  }
}
