import { useApp } from '../state/AppContext'
import { Button, Note, Page, TopBar } from '../components/ui'

const PERGUNTAS = [
  ['Como agendo um horário?', 'Em Início, escolha uma barbearia, toque em um barbeiro, escolha o dia e um horário livre. Depois selecione o serviço e confirme.'],
  ['Posso cancelar?', 'Sim. Abra a reserva em Agendamentos e toque em Cancelar. O horário volta a ficar livre e a reserva fica no seu Histórico.'],
  ['Como pago?', 'O pagamento é feito no estabelecimento, depois do atendimento.'],
  ['Como funciona a distância?', 'Ligue a localização ou informe um endereço. Calculamos a distância em linha reta e mostramos as barbearias dentro do raio escolhido.'],
  ['Sou barbeiro, onde vejo minha agenda?', 'No menu lateral ou no Perfil, toque em Área do barbeiro.'],
]

export function Ajuda() {
  return (
    <>
      <TopBar title="Ajuda" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">Ajuda</h1>
        <div className="mt-4 divide-y divide-line/70">
          {PERGUNTAS.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-semibold">
                {q}
                <span className="text-brand-ink transition-transform duration-200 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] leading-6 text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Page>
    </>
  )
}

export function Sobre() {
  const { resetarDados } = useApp()
  return (
    <>
      <TopBar title="Sobre" />
      <Page className="pt-3">
        <h1 className="text-[28px] font-bold tracking-tight">
          Sobre o Barber<span className="text-brand-ink">HUB</span>
        </h1>
        <p className="mt-3 text-[15.5px] leading-6 text-muted">
          O BarberHUB organiza a descoberta de barbearias de Manaus e o agendamento de serviços. Clientes consultam o catálogo, favoritam unidades e reservam horários; barbeiros acompanham atendimentos, finalizam serviços e controlam a própria agenda.
        </p>
        <div className="mt-5">
          <Note>
            Projeto acadêmico. Nomes e endereços do catálogo são referências reais de Manaus; serviços, preços, profissionais e horários são dados de demonstração, sem parceria comercial nem envio de reservas às empresas.
          </Note>
        </div>
        <p className="mt-5 text-[14px] text-faint">Equipe: Renatto Gabriel (PO), Nicolas Duarte (desenvolvimento), Sávio Santos (QA) e Yan Félix (documentação).</p>
        {resetarDados && (
          <Button variant="ghost" size="md" className="mt-8" onClick={resetarDados}>
            Restaurar dados de demonstração
          </Button>
        )}
      </Page>
    </>
  )
}
