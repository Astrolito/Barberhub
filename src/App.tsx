import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { AppProvider } from './state/AppContext'
import { RequireAuth, TabsLayout, Toaster } from './components/Shell'
import Home from './pages/Home'
import Barbearia, { NaoEncontrado, ServicoDetalhe } from './pages/Barbearia'
import { Agendar, Profissional } from './pages/Agendar'
import Agendamentos, { AgendamentoDetalhe, Historico } from './pages/Agendamentos'
import Perfil, { Favoritos, MeusDados, Pagamentos } from './pages/Perfil'
import Entrar from './pages/Entrar'
import { Ajuda, Sobre } from './pages/Info'
import AreaBarbeiro, { Atendimentos, MeusHorarios, MinhaBarbearia } from './pages/barbeiro/AreaBarbeiro'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const auth = (el: JSX.Element) => <RequireAuth>{el}</RequireAuth>

export default function App() {
  return (
    <AppProvider>
      {/* HashRouter: funciona em hospedagem estática e dentro do webview (file://). */}
      <HashRouter>
        <ScrollTop />
        <Routes>
          <Route path="/entrar" element={<Entrar />} />
          <Route element={auth(<TabsLayout />)}>
            <Route index element={<Home />} />
            <Route path="favoritos" element={<Favoritos />} />
            <Route path="agendamentos" element={<Agendamentos />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
          <Route path="/barbearia/:id" element={auth(<Barbearia />)} />
          <Route path="/servico/:id" element={auth(<ServicoDetalhe />)} />
          <Route path="/profissional/:id" element={auth(<Profissional />)} />
          <Route path="/agendar/:horarioId" element={auth(<Agendar />)} />
          <Route path="/agendamento/:id" element={auth(<AgendamentoDetalhe />)} />
          <Route path="/perfil/dados" element={auth(<MeusDados />)} />
          <Route path="/perfil/pagamentos" element={auth(<Pagamentos />)} />
          <Route path="/perfil/historico" element={auth(<Historico />)} />
          <Route path="/barbeiro" element={auth(<AreaBarbeiro />)} />
          <Route path="/barbeiro/barbearia" element={auth(<MinhaBarbearia />)} />
          <Route path="/barbeiro/atendimentos" element={auth(<Atendimentos />)} />
          <Route path="/barbeiro/horarios" element={auth(<MeusHorarios />)} />
          <Route path="/ajuda" element={<Ajuda />} />
          <Route path="/sobre" element={<Sobre />} />
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
        <Toaster />
      </HashRouter>
    </AppProvider>
  )
}
