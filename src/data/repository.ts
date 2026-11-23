// Camada de persistência. A interface isola o app do armazenamento:
// hoje é localStorage (funciona offline e dentro do webview); amanhã pode ser
// Supabase/Firebase/API própria sem mudar telas nem regras.

import type { Banco } from '../domain/types'
import { criarSeed } from './seed'

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
        const db = JSON.parse(raw) as Banco
        if (db.versao === 2) return (this.memoria = db)
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
          this.salvar(v2)
          return (this.memoria = v2)
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
