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
        if (db.versao === 1) return (this.memoria = db)
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
