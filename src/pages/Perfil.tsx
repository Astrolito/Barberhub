import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp, useUsuario } from '../state/AppContext'
import { Button, Empty, Note, Page, Row, TopBar, cx } from '../components/ui'
import { ICalendar, ICamera, ICard, IHeart, IHistory, ILogout, IScissors, IWallet } from '../components/Icons'
import { CardBarbearia } from './Home'
import { OPCOES_DISTANCIA } from '../data/seed'
import { raioAplicado } from '../domain/rules'
import { lerImagem } from '../lib/image'

export function Avatar({ nome, foto, size = 'lg' }: { nome: string; foto?: string; size?: 'lg' | 'sm' }) {
  const cls = size === 'lg' ? 'h-[104px] w-[104px] rounded-[22px] text-[46px]' : 'h-10 w-10 rounded-full text-[16px]'
  return foto ? (
    <img src={foto} alt="" className={cx(cls, 'object-cover')} />
  ) : (
    <div className={cx(cls, 'grid shrink-0 place-items-center bg-gradient-to-br from-[#6b6fd6] to-[#5457b8] font-semibold text-white')}>{nome[0]?.toUpperCase()}</div>
  )
}

export default function Perfil() {
  const { sair, atualizarUsuario } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const raio = raioAplicado(u)
  return (
    <Page className="pt-5">
      <div className="flex gap-4">
        <Avatar nome={u.nome} foto={u.foto} />
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="truncate text-[24px] font-bold leading-tight">
            {u.nome} <span className="font-medium text-muted">({u.papel})</span>
          </h1>
          <p className="truncate text-[14.5px] text-muted">{u.email}</p>
          <button onClick={() => nav('/perfil/dados')} className="press mt-3 h-9 rounded-full bg-brand px-4 text-[14.5px] font-semibold text-white">
            Meus dados
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-2.5">
        <Button icon={<ICalendar size={20} />} onClick={() => nav('/agendamentos')}>
          Meus agendamentos
        </Button>
        <Button icon={<ICard size={20} />} onClick={() => nav('/perfil/pagamentos')}>
          Opções de pagamento
        </Button>
        <Button icon={<IHistory size={20} />} onClick={() => nav('/perfil/historico')}>
          Histórico
        </Button>
        {u.papel === 'Barbeiro' && (
          <Button variant="soft" icon={<IScissors size={20} />} onClick={() => nav('/barbeiro')}>
            Área do barbeiro
          </Button>
        )}
      </div>

      <h2 className="mb-2 mt-8 text-[17px] font-semibold">Distância das barbearias</h2>
      <select
        value={raio}
        onChange={(e) => atualizarUsuario({ raioBuscaKm: Number(e.target.value) })}
        className="h-12 w-full appearance-none rounded-xl border border-line bg-surface2 px-3.5 text-[16px] focus:border-brand focus:outline-none"
      >
        {OPCOES_DISTANCIA.map((o) => (
          <option key={o.limiteKm} value={o.limiteKm}>
            {o.nome}
          </option>
        ))}
      </select>

      <button
        onClick={async () => {
          await sair()
          nav('/entrar', { replace: true })
        }}
        className="press mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-semibold text-danger hover:bg-danger-soft"
      >
        <ILogout size={20} /> Sair da conta
      </button>
    </Page>
  )
}

export function MeusDados() {
  const { atualizarUsuario, toast } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const [nome, setNome] = useState(u.nome)
  const [foto, setFoto] = useState(u.foto)
  const [salvando, setSalvando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <TopBar title="Meus dados" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Meus dados</h1>
        <div className="mt-6 flex items-center gap-4">
          <Avatar nome={nome || u.nome} foto={foto} />
          <div className="space-y-2">
            <Button size="sm" variant="ghost" icon={<ICamera size={18} />} onClick={() => input.current?.click()}>
              Trocar foto
            </Button>
            {foto && (
              <button className="block px-4 text-[14px] text-danger" onClick={() => setFoto(undefined)}>
                Remover foto
              </button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setFoto(await lerImagem(f, 320))
            }}
          />
        </div>
        <label className="mt-6 block text-[15px] font-semibold" htmlFor="nome">
          Nome
        </label>
        <input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-line bg-surface2 px-3.5 text-[16px] focus:border-brand focus:outline-none"
        />
        <label className="mt-5 block text-[15px] font-semibold">E-mail</label>
        <div className="mt-2 flex h-12 items-center rounded-xl border border-line/60 px-3.5 text-[16px] text-muted">{u.email}</div>
        <p className="mt-2 text-[13.5px] text-faint">E-mail, papel e vínculos profissionais não podem ser alterados aqui.</p>
        <Button
          className="mt-7"
          disabled={!nome.trim() || salvando}
          onClick={async () => {
            setSalvando(true)
            const ok = await atualizarUsuario({ nome: nome.trim(), foto })
            setSalvando(false)
            // Só confirma e volta quando salvou de verdade; a falha já mostra o motivo.
            if (ok) {
              toast('Dados atualizados.')
              nav(-1)
            }
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar'}
        </Button>
      </Page>
    </>
  )
}

export function Pagamentos() {
  return (
    <>
      <TopBar title="Opções de pagamento" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Opções de pagamento</h1>
        <div className="mt-5">
          <Note>O pagamento é feito diretamente no estabelecimento, após o atendimento. O BarberHUB não cobra nem guarda dados de cartão.</Note>
        </div>
        <div className="mt-4">
          <Row leading={<IWallet className="text-brand-ink" />} title="No estabelecimento" subtitle="Dinheiro, Pix ou cartão, conforme a barbearia" trailing={<span className="text-[13px] font-semibold text-ok">ATIVO</span>} />
          <Row leading={<ICard className="text-faint" />} title="Pagamento online" subtitle="Em breve" trailing={<span />} />
        </div>
      </Page>
    </>
  )
}

export function Favoritos() {
  const { db } = useApp()
  const u = useUsuario()
  const nav = useNavigate()
  const lista = db.barbearias.filter((b) => u.favoritos.includes(b.id))
  return (
    <Page className="pt-4">
      <h1 className="text-[28px] font-bold tracking-tight">Favoritos</h1>
      {lista.length ? (
        <div className="mt-5 grid grid-cols-2 gap-x-3.5 gap-y-6">
          {lista.map((b, i) => (
            <CardBarbearia key={b.id} b={b} i={i} />
          ))}
        </div>
      ) : (
        <Empty icon={<IHeart />} title="Nenhum favorito ainda" text="Toque em Favoritar na página de uma barbearia para encontrá-la rápido aqui." action={<Button size="md" onClick={() => nav('/')}>Explorar barbearias</Button>} />
      )}
    </Page>
  )
}
