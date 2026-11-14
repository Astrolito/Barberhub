import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Agendamento, Banco, Barbearia, Horario, Profissional, Servico, Usuario } from '../domain/types'
import type { Backend, Estado } from './backend'

// Linhas do Postgres (snake_case) → modelo do app (camelCase).
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const aBarbearia = (r: Row): Barbearia => ({
  id: r.id, nome: r.nome, endereco: r.endereco, cidade: r.cidade, bairro: r.bairro, descricao: r.descricao,
  lat: r.lat, lng: r.lng, fotoCapa: r.foto_capa ?? undefined, marca: r.marca,
})
const aProfissional = (r: Row): Profissional => ({
  id: r.id, nome: r.nome, descricao: r.descricao, especialidades: r.especialidades, barbeariaId: r.barbearia_id,
  emailAcesso: r.email_acesso ?? undefined, foto: r.foto ?? undefined,
})
const aServico = (r: Row): Servico => ({
  id: r.id, barbeariaId: r.barbearia_id, nome: r.nome, descricao: r.descricao, preco: Number(r.preco),
  duracaoMinutos: r.duracao_minutos, categoria: r.categoria, inclui: r.inclui, disponivel: r.disponivel, icone: r.icone,
})
const aHorario = (r: Row): Horario => ({
  id: r.id, profissionalId: r.profissional_id, barbeariaId: r.barbearia_id, inicio: r.inicio, fim: r.fim, status: r.status,
})
const aAgendamento = (r: Row): Agendamento => ({
  id: r.id, protocolo: r.protocolo, barbeariaId: r.barbearia_id, servicoId: r.servico_id, profissionalId: r.profissional_id,
  horarioId: r.horario_id, clienteEmail: r.cliente_email, barbeiroEmail: r.barbeiro_email ?? undefined, inicio: r.inicio,
  fim: r.fim, status: r.status, precoReservado: r.preco_reservado == null ? undefined : Number(r.preco_reservado),
  duracaoReservada: r.duracao_reservada ?? undefined, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
})
const aUsuario = (r: Row): Usuario => ({
  id: r.id, email: r.email, nome: r.nome, foto: r.foto ?? undefined, papel: r.papel,
  profissionalId: r.profissional_id ?? undefined, barbeariaId: r.barbearia_id ?? undefined,
  localizacao: r.localizacao ?? undefined, raioBuscaKm: r.raio_busca_km ?? undefined,
  favoritos: r.favoritos ?? [], dataBusca: r.data_busca ?? {},
})
const deUsuario = (p: Partial<Usuario>): Row => {
  const r: Row = {}
  if ('nome' in p) r.nome = p.nome
  if ('foto' in p) r.foto = p.foto ?? null
  if ('localizacao' in p) r.localizacao = p.localizacao ?? null
  if ('raioBuscaKm' in p) r.raio_busca_km = p.raioBuscaKm ?? null
  if ('favoritos' in p) r.favoritos = p.favoritos
  if ('dataBusca' in p) r.data_busca = p.dataBusca ?? {}
  return r
}

const vazio = (): Banco => ({ versao: 1, usuarios: [], barbearias: [], profissionais: [], servicos: [], horarios: [], agendamentos: [] })

function erro(e: { message?: string } | null): never {
  const m = e?.message ?? 'Algo deu errado.'
  throw new Error(/fetch|network/i.test(m) ? 'Sem conexão com o servidor. Verifique sua internet.' : m)
}

export function criarBackendSupabase(url: string, chave: string): Backend {
  const sb: SupabaseClient = createClient(url, chave, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  let db = vazio()
  let email: string | null = null
  let pronto = false
  let ouvinte: ((e: Estado) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const emitir = () => ouvinte?.({ db, email, pronto })

  async function recarregar() {
    const { data: s } = await sb.auth.getSession()
    const uid = s.session?.user.id
    const desde = new Date(Date.now() - 45 * 864e5).toISOString()
    const [b, p, sv, h, a, me] = await Promise.all([
      sb.from('barbearias').select('*').order('nome'),
      sb.from('profissionais').select('*'),
      sb.from('servicos').select('*'),
      sb.from('horarios').select('*').gte('inicio', desde),
      uid ? sb.from('agendamentos').select('*') : Promise.resolve({ data: [], error: null }),
      uid ? sb.from('profiles').select('*').eq('id', uid).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    const falha = [b, p, sv, h, a, me].find((x) => x.error)
    if (falha?.error) erro(falha.error)
    // Ordena o catálogo como no modo local (Procópio primeiro).
    const barbearias = (b.data ?? []).map(aBarbearia).sort((x, y) => x.id.localeCompare(y.id))
    db = {
      versao: 1,
      barbearias,
      profissionais: (p.data ?? []).map(aProfissional),
      servicos: (sv.data ?? []).map(aServico),
      horarios: (h.data ?? []).map(aHorario),
      agendamentos: (a.data ?? []).map(aAgendamento),
      usuarios: me.data ? [aUsuario(me.data)] : [],
    }
    email = me.data?.email ?? null
    pronto = true
    emitir()
  }
  const agendar = () => {
    clearTimeout(timer)
    timer = setTimeout(() => recarregar().catch(() => {}), 250)
  }

  const meuId = () => db.usuarios[0]?.id

  return {
    modo: 'supabase',
    iniciar(cb) {
      ouvinte = cb
      recarregar().catch(() => {
        pronto = true
        emitir()
      })
      const { data: auth } = sb.auth.onAuthStateChange((ev) => {
        if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') agendar()
      })
      const canal = sb
        .channel('barberhub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, agendar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'agendamentos' }, agendar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'barbearias' }, agendar)
        .subscribe()
      const foco = () => document.visibilityState === 'visible' && agendar()
      document.addEventListener('visibilitychange', foco)
      return () => {
        ouvinte = null
        auth.subscription.unsubscribe()
        sb.removeChannel(canal)
        document.removeEventListener('visibilitychange', foco)
      }
    },
    async entrar(e) {
      const redirect = window.location.origin + window.location.pathname
      const { error } = await sb.auth.signInWithOtp({ email: e.trim().toLowerCase(), options: { emailRedirectTo: redirect } })
      if (error) erro(error)
      return 'codigo_enviado'
    },
    async verificarCodigo(e, codigo) {
      const { error } = await sb.auth.verifyOtp({ email: e.trim().toLowerCase(), token: codigo.trim(), type: 'email' })
      if (error) erro({ message: 'Código inválido ou expirado. Peça um novo.' })
      await recarregar()
    },
    async sair() {
      await sb.auth.signOut()
      db = { ...db, usuarios: [], agendamentos: [] }
      email = null
      emitir()
    },
    async atualizarUsuario(patch) {
      const id = meuId()
      if (!id) erro({ message: 'Entre na sua conta para continuar.' })
      // Otimista: a tela responde na hora; o servidor confirma em seguida.
      db = { ...db, usuarios: db.usuarios.map((u) => ({ ...u, ...patch })) }
      emitir()
      const { error } = await sb.from('profiles').update(deUsuario(patch)).eq('id', id)
      if (error) {
        agendar()
        erro(error)
      }
    },
    async prepararHorarios(p, d) {
      const { error } = await sb.rpc('preparar_horarios', { p_profissional: p, p_dia: d })
      if (error) erro(error)
      await recarregar()
    },
    async confirmar(h, s) {
      const { data, error } = await sb.rpc('confirmar_agendamento', { p_horario: h, p_servico: s })
      if (error) erro(error)
      await recarregar()
      return aAgendamento(data as Row)
    },
    async cancelar(id) {
      const { error } = await sb.rpc('cancelar_agendamento', { p_id: id })
      if (error) erro(error)
      await recarregar()
    },
    async finalizar(id) {
      const { error } = await sb.rpc('finalizar_atendimento', { p_id: id })
      if (error) erro(error)
      await recarregar()
    },
    async alternarBloqueio(id) {
      const { error } = await sb.rpc('alternar_bloqueio', { p_horario: id })
      if (error) erro(error)
      await recarregar()
    },
    async atualizarFotoBarbearia(id, foto) {
      const { error } = await sb.rpc('atualizar_foto_barbearia', { p_barbearia: id, p_foto: foto ?? null })
      if (error) erro(error)
      await recarregar()
    },
  }
}
