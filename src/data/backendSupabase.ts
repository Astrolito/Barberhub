import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js'
import type { Agendamento, Assinatura, Avaliacao, Banco, Barbearia, Horario, Parceria, Plano, Profissional, Servico, Usuario } from '../domain/types'
import type { Backend, Estado } from './backend'
import { uuid } from '../lib/id'

// Linhas do Postgres (snake_case) → modelo do app (camelCase).
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const aBarbearia = (r: Row): Barbearia => ({
  id: r.id, nome: r.nome, endereco: r.endereco, cidade: r.cidade, bairro: r.bairro, descricao: r.descricao,
  lat: r.lat, lng: r.lng, fotoCapa: r.foto_capa ?? undefined, marca: r.marca,
  telefone: r.telefone ?? undefined, whatsapp: r.whatsapp ?? undefined, visivelAte: r.visivel_ate ?? undefined,
})
const aPlano = (r: Row): Plano => ({
  id: r.id, nome: r.nome, precoMensal: Number(r.preco_mensal), maxProfissionais: r.max_profissionais, descricao: r.descricao, ordem: r.ordem,
})
// A chave da assinatura é a barbearia; o app usa o mesmo valor como id.
const aAssinatura = (r: Row): Assinatura => ({
  id: r.barbearia_id ?? r.id, barbeariaId: r.barbearia_id ?? r.id, planoId: r.plano_id, status: r.status, inicio: r.inicio,
  validaAte: r.valida_ate, atualizadoEm: r.atualizado_em,
})
const aParceria = (r: Row): Parceria => ({
  id: r.id, barbeariaId: r.barbearia_id, descontoPct: r.desconto_pct, dias: r.dias, status: r.status,
  inicio: r.inicio ?? undefined, fim: r.fim ?? undefined, criadoEm: r.criado_em,
})
const aProfissional = (r: Row): Profissional => ({
  id: r.id, nome: r.nome, descricao: r.descricao, especialidades: r.especialidades, barbeariaId: r.barbearia_id,
  foto: r.foto ?? undefined, jornada: r.jornada ?? undefined,
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
  horarioId: r.horario_id, clienteEmail: r.cliente_email, clienteNome: r.cliente_nome ?? undefined, inicio: r.inicio,
  fim: r.fim, status: r.status, precoReservado: r.preco_reservado == null ? undefined : Number(r.preco_reservado),
  duracaoReservada: r.duracao_reservada ?? undefined, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em,
})
const aAvaliacao = (r: Row): Avaliacao => ({
  id: r.id, agendamentoId: r.agendamento_id, barbeariaId: r.barbearia_id, profissionalId: r.profissional_id,
  clienteNome: r.cliente_nome, nota: r.nota, comentario: r.comentario, criadoEm: r.criado_em,
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

const vazio = (): Banco => ({ versao: 3, usuarios: [], barbearias: [], profissionais: [], servicos: [], horarios: [], agendamentos: [], avaliacoes: [], planos: [], assinaturas: [], parcerias: [] })

const SEM_CONEXAO = 'Sem conexão com o servidor. Verifique sua internet.'
function erro(e: { message?: string } | null): never {
  const m = e?.message ?? 'Algo deu errado.'
  throw new Error(/fetch|network|load failed/i.test(m) ? SEM_CONEXAO : m)
}

/** Tabelas do Banco que chegam por Realtime e como converter cada linha. */
const TABELAS = {
  barbearias: aBarbearia,
  profissionais: aProfissional,
  servicos: aServico,
  horarios: aHorario,
  agendamentos: aAgendamento,
  avaliacoes: aAvaliacao,
  assinaturas: aAssinatura,
  parcerias: aParceria,
} as const
type Tabela = keyof typeof TABELAS

export function criarBackendSupabase(url: string, chave: string): Backend {
  const sb: SupabaseClient = createClient(url, chave, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  let db = vazio()
  let email: string | null = null
  let pronto = false
  let falha: string | undefined
  let ouvinte: ((e: Estado) => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const emitir = () => ouvinte?.({ db, email, pronto, erro: falha })

  /** Troca ou insere linhas de uma tabela sem recarregar o resto. */
  function aplicar<T extends Tabela>(t: T, linhas: Row[], remover: string[] = []) {
    const conv = TABELAS[t] as (r: Row) => { id: string }
    const novos = new Map(linhas.map((r) => { const x = conv(r); return [String(x.id), x] as const }))
    const atual = db[t] as { id: string }[]
    const fora = new Set(remover)
    const mantidos = atual.filter((x) => !fora.has(x.id)).map((x) => novos.get(x.id) ?? x)
    const ids = new Set(atual.map((x) => x.id))
    const inseridos = [...novos.values()].filter((x) => !ids.has(x.id))
    db = { ...db, [t]: [...mantidos, ...inseridos] }
    emitir()
  }

  // Carga completa: na abertura, ao entrar/sair e ao voltar para o app. O resto é incremental.
  async function recarregar() {
    const { data: s } = await sb.auth.getSession()
    const uid = s.session?.user.id
    const ontem = new Date()
    ontem.setHours(0, 0, 0, 0)
    ontem.setDate(ontem.getDate() - 1)
    const [b, p, sv, h, a, av, me, pl, as, pc] = await Promise.all([
      sb.from('barbearias').select('*'),
      sb.from('profissionais').select('*'),
      sb.from('servicos').select('*'),
      sb.from('horarios').select('*').gte('inicio', ontem.toISOString()),
      uid ? sb.from('agendamentos').select('*') : Promise.resolve({ data: [], error: null }),
      sb.from('avaliacoes').select('*').order('criado_em', { ascending: false }).limit(500),
      uid ? sb.from('profiles').select('*').eq('id', uid).maybeSingle() : Promise.resolve({ data: null, error: null }),
      sb.from('planos').select('*').order('ordem'),
      // RLS: só a assinatura da própria unidade (barbeiro); vazio para clientes.
      uid ? sb.from('assinaturas').select('*') : Promise.resolve({ data: [], error: null }),
      // RLS: parcerias em vigor + o histórico da própria unidade (barbeiro).
      sb.from('parcerias').select('*'),
    ])
    const f = [b, p, sv, h, a, av, me, pl, as, pc].find((x) => x.error)
    if (f?.error) erro(f.error)
    db = {
      versao: 3,
      // Ordena o catálogo como no modo local (Procópio primeiro).
      barbearias: (b.data ?? []).map(aBarbearia).sort((x, y) => x.id.localeCompare(y.id)),
      profissionais: (p.data ?? []).map(aProfissional),
      servicos: (sv.data ?? []).map(aServico),
      horarios: (h.data ?? []).map(aHorario),
      agendamentos: (a.data ?? []).map(aAgendamento),
      avaliacoes: (av.data ?? []).map(aAvaliacao),
      usuarios: me.data ? [aUsuario(me.data)] : [],
      planos: (pl.data ?? []).map(aPlano),
      assinaturas: (as.data ?? []).map(aAssinatura),
      parcerias: (pc.data ?? []).map(aParceria),
    }
    email = me.data?.email ?? null
    pronto = true
    falha = undefined
    emitir()
  }
  const recarregarSilencioso = () => {
    clearTimeout(timer)
    timer = setTimeout(
      () =>
        recarregar().catch((e) => {
          // Com dados na tela, uma falha de recarga não derruba o app.
          if (!db.barbearias.length) {
            falha = e instanceof Error ? e.message : SEM_CONEXAO
            pronto = true
            emitir()
          }
        }),
      250,
    )
  }

  async function buscar<T extends Tabela>(t: T, coluna: string, valores: string[]) {
    if (!valores.length) return
    const { data, error } = await sb.from(t).select('*').in(coluna, valores)
    if (error) return // a mudança já foi feita; o Realtime ou a próxima carga corrigem a tela
    aplicar(t, data ?? [])
  }

  const meuId = () => db.usuarios[0]?.id
  const eu = () => db.usuarios[0]

  return {
    modo: 'supabase',
    iniciar(cb) {
      ouvinte = cb
      recarregar().catch((e) => {
        falha = e instanceof Error ? e.message : SEM_CONEXAO
        pronto = true
        emitir()
      })
      const { data: auth } = sb.auth.onAuthStateChange((ev) => {
        if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'USER_UPDATED') recarregarSilencioso()
      })
      // Realtime: aplica só a linha que mudou, em vez de baixar o banco inteiro de novo.
      let canal = sb.channel('barberhub')
      for (const t of Object.keys(TABELAS) as Tabela[]) {
        canal = canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, (ev: RealtimePostgresChangesPayload<Row>) => {
          if (ev.eventType === 'DELETE') aplicar(t, [], [String((ev.old as Row).id ?? (ev.old as Row).barbearia_id)])
          else aplicar(t, [ev.new as Row])
        })
      }
      canal.subscribe()
      const foco = () => document.visibilityState === 'visible' && recarregarSilencioso()
      document.addEventListener('visibilitychange', foco)
      return () => {
        ouvinte = null
        auth.subscription.unsubscribe()
        sb.removeChannel(canal)
        document.removeEventListener('visibilitychange', foco)
      }
    },
    async recarregar() {
      try {
        await recarregar()
      } catch (e) {
        falha = e instanceof Error ? e.message : SEM_CONEXAO
        emitir()
        throw e
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
      const antes = db.usuarios
      // Otimista: a tela responde na hora; o servidor confirma em seguida.
      db = { ...db, usuarios: db.usuarios.map((u) => ({ ...u, ...patch })) }
      emitir()
      const { error } = await sb.from('profiles').update(deUsuario(patch)).eq('id', id)
      if (error) {
        db = { ...db, usuarios: antes }
        emitir()
        erro(error)
      }
    },
    async prepararHorarios(p, d) {
      const { error } = await sb.rpc('preparar_horarios', { p_profissional: p, p_dia: d })
      if (error) erro(error)
      const [y, m, dd] = d.split('-').map(Number)
      const ini = new Date(y, m - 1, dd)
      const fim = new Date(y, m - 1, dd + 1)
      const { data, error: e2 } = await sb.from('horarios').select('*').eq('profissional_id', p).gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString())
      if (e2) return
      const ids = new Set((data ?? []).map((r) => String(r.id)))
      const sairam = db.horarios.filter((h) => h.profissionalId === p && new Date(h.inicio) >= ini && new Date(h.inicio) < fim && !ids.has(h.id)).map((h) => h.id)
      aplicar('horarios', data ?? [], sairam)
    },
    async confirmar(h, s) {
      const { data, error } = await sb.rpc('confirmar_agendamento', { p_horario: h, p_servico: s })
      if (error) erro(error)
      aplicar('agendamentos', [data as Row])
      await buscar('horarios', 'id', [h])
      return aAgendamento(data as Row)
    },
    async remarcar(id, h) {
      const antigo = db.agendamentos.find((a) => a.id === id)?.horarioId
      const { data, error } = await sb.rpc('remarcar_agendamento', { p_id: id, p_horario: h })
      if (error) erro(error)
      aplicar('agendamentos', [data as Row])
      await buscar('horarios', 'id', [h, ...(antigo ? [antigo] : [])])
      return aAgendamento(data as Row)
    },
    async cancelar(id) {
      const { error } = await sb.rpc('cancelar_agendamento', { p_id: id })
      if (error) erro(error)
      await buscar('agendamentos', 'id', [id])
      const h = db.agendamentos.find((a) => a.id === id)?.horarioId
      if (h) await buscar('horarios', 'id', [h])
    },
    async encerrar(id, resultado) {
      const { error } = await sb.rpc('encerrar_atendimento', { p_id: id, p_resultado: resultado })
      if (error) erro(error)
      await buscar('agendamentos', 'id', [id])
    },
    async alternarBloqueio(id) {
      const { error } = await sb.rpc('alternar_bloqueio', { p_horario: id })
      if (error) erro(error)
      await buscar('horarios', 'id', [id])
    },
    async salvarJornada(j) {
      const { error } = await sb.rpc('salvar_jornada', { p_jornada: j })
      if (error) erro(error)
      const p = eu()?.profissionalId
      if (p) await buscar('profissionais', 'id', [p])
    },
    async salvarServico(s) {
      const { data, error } = await sb.rpc('salvar_servico', { p_servico: s })
      if (error) erro(error)
      aplicar('servicos', [data as Row])
      return aServico(data as Row)
    },
    async atualizarBarbearia(d) {
      const { error } = await sb.rpc('atualizar_barbearia', { p_descricao: d.descricao, p_telefone: d.telefone ?? '', p_whatsapp: d.whatsapp ?? '' })
      if (error) erro(error)
      const b = eu()?.barbeariaId
      if (b) await buscar('barbearias', 'id', [b])
    },
    async avaliar(id, nota, comentario) {
      const { error } = await sb.rpc('avaliar_atendimento', { p_id: id, p_nota: nota, p_comentario: comentario })
      if (error) erro(error)
      await buscar('avaliacoes', 'agendamento_id', [id])
    },
    async atualizarFotoBarbearia(id, foto) {
      const { error } = await sb.rpc('atualizar_foto_barbearia', { p_barbearia: id, p_foto: foto ?? null })
      if (error) erro(error)
      await buscar('barbearias', 'id', [id])
    },
    async escolherPlano(id) {
      const { data, error } = await sb.rpc('escolher_plano', { p_plano: id })
      if (error) erro(error)
      const row = data as Row
      aplicar('assinaturas', [row])
      await buscar('barbearias', 'id', [row.barbearia_id])
      return aAssinatura(row)
    },
    async cancelarAssinatura() {
      const { data, error } = await sb.rpc('cancelar_assinatura')
      if (error) erro(error)
      aplicar('assinaturas', [data as Row])
    },
    async solicitarParceria(pct, dias) {
      const { data, error } = await sb.rpc('solicitar_parceria', { p_desconto: pct, p_dias: dias })
      if (error) erro(error)
      aplicar('parcerias', [data as Row])
      return aParceria(data as Row)
    },
    async encerrarParceria(id) {
      const { data, error } = await sb.rpc('encerrar_parceria', { p_id: id })
      if (error) erro(error)
      aplicar('parcerias', [data as Row])
    },
    async subirImagem(pasta, dataUrl) {
      const u = eu()
      if (!u) erro({ message: 'Entre na sua conta para continuar.' })
      const dono = pasta === 'perfis' ? u.id : u.barbeariaId
      if (!dono) erro({ message: 'Apenas o barbeiro vinculado pode alterar a foto.' })
      const blob = await (await fetch(dataUrl)).blob()
      const caminho = `${pasta}/${dono}/${uuid()}.jpg`
      const { error } = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false })
      if (error) erro(error)
      return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl
    },
  }
}
