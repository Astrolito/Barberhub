# BarberHUB

App web e mobile para descobrir barbearias em Manaus e agendar horários sem precisar ligar. É a reconstrução em código do MVP feito no Glide, seguindo a Documentação técnica v1.4 e o UML de 06/10/2026, com o mesmo design base (preto/carvão + azul `#1d6fe0`) e várias melhorias.

- **Em produção:** https://barberhub-one.vercel.app
- **Backend:** Supabase (PostgreSQL com RLS, Auth por e-mail, Realtime e Storage), região São Paulo
- **Mobile:** Android e iOS pelo Capacitor, com o mesmo código

Equipe: Renatto Gabriel (PO) · Nicolas Duarte (Dev) · Sávio Santos (QA) · Yan Félix (Docs)

## O que o app faz

**Cliente**

- Entra sem senha, por link ou código de 6 dígitos enviado por e-mail.
- Vê as **parceiras BarberHUB** em destaque, com preço especial pelo app.
- Vê as barbearias ordenadas pela distância, com raio de 1, 3, 5, 10, 20 km ou sem limite (padrão 5 km).
- **Início com mapa e pesquisa juntos:** o mapa ocupa a tela, com a pesquisa por barbearia, bairro ou endereço em cima e a lista numa gaveta embaixo. A pesquisa filtra a lista e os pinos ao mesmo tempo. Mostra o ponto de busca e o círculo do raio escolhido; a localização vem do GPS, de um endereço ou do bairro.
- Página da unidade com serviços, preços, profissionais, avaliações, WhatsApp, telefone e horário de atendimento.
- Agenda escolhendo serviço, profissional, data (próximos 14 dias) e horário livre.
- Remarca ou cancela até 2h antes, adiciona ao Google Agenda ou `.ics`, recebe lembrete 1h antes (app instalado), favorita unidades, avalia atendimentos finalizados e vê o histórico.

**Barbeiro** (Área do barbeiro, no menu lateral e no Perfil)

- Configura a jornada: dias, início, fim e duração do intervalo (30 a 120 min).
- Horários do dia gerados automaticamente; bloqueia e libera horários livres.
- Vê os atendimentos com o nome do cliente e encerra como `Finalizado` ou `Não compareceu`.
- Painel: atendimentos do dia e da semana, faturado no mês, nota média.
- Cadastra e edita serviços; edita descrição, contato e foto de capa da unidade.
- **Plano e parceria:** vê a assinatura (teste grátis, ativa, aguardando pagamento, vencida), troca de plano, renova ou cancela, e pede para virar **parceira BarberHUB** com preço diferenciado.

**Modelo de receita**

- **Assinatura mensal** paga pela barbearia: Básico R$ 49,90 (até 2 barbeiros), Profissional R$ 89,90 (até 5) e Premium R$ 149,90 (ilimitado), com 30 dias de teste grátis. Sem assinatura em dia, a barbearia sai da busca e do mapa e não recebe reservas.
- **Parcerias:** a busca continua pela distância. A parceira oferece de 10% a 30% de desconto em todos os serviços agendados pelo app e ganha destaque na seção "Parceiras BarberHUB" do Início, com selo "Parceira", pino dourado no mapa e preço riscado.
- Não há gateway de pagamento: a equipe envia a cobrança e confirma no Supabase. Veja [Cobrança e parcerias](docs/implantacao.md#cobrança-e-parcerias).

Quem vira barbeiro é decidido por uma **lista de e-mails de acesso** no banco (tabela `acessos_profissionais`). Veja [Dar acesso de barbeiro](docs/implantacao.md#dar-acesso-de-barbeiro).

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # testes das regras de agendamento (Vitest)
npm run build        # checa os tipos e gera dist/ (web e Capacitor)
npm run build:single # gera dist-single/index.html, um arquivo único para prévia
npm run dev:https    # https na rede local, para testar o GPS no celular/tablet
```

O app tem dois modos, escolhidos pelas variáveis de ambiente (copie `.env.example` para `.env`):

| Modo | Quando | Dados |
|---|---|---|
| Demonstração | sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | no aparelho (localStorage), contas de demonstração na tela de entrada |
| Supabase | com as duas variáveis | no servidor, login por e-mail, atualização em tempo real |

Contas do modo demonstração: `cliente@barberhub.app` (cliente) e `barbeiro@barberhub.app` (barbeiro da Procópio). Para zerar os dados: menu lateral > Sobre o BarberHUB > Restaurar dados de demonstração.

Localização: o navegador só libera o GPS em `https` ou `localhost`. Para testar no tablet pelo PC, rode `npm run dev:https`, abra `https://IP-do-PC:5173` e aceite o aviso de certificado.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/requisitos.md](docs/requisitos.md) | Requisitos funcionais, não funcionais, de negócio, de sistema e de usuário, com rastreabilidade |
| [docs/arquitetura.md](docs/arquitetura.md) | Camadas, pastas, roteamento, mapa, máquinas de estado e integrações |
| [docs/banco-de-dados.md](docs/banco-de-dados.md) | As 11 tabelas, RLS, funções SQL, assinaturas e parcerias, Storage, Realtime e migrações |
| [docs/implantacao.md](docs/implantacao.md) | Supabase, Vercel, acesso de barbeiro, cobrança e parcerias, app Android/iOS e operação |
| [docs/historico.md](docs/historico.md) | Melhorias em relação ao Glide e versões |

## Tecnologias

React 18 · TypeScript · Vite · Tailwind CSS · React Router (HashRouter) · Supabase · Leaflet + OpenStreetMap · Capacitor 8 · Vitest · GitHub Actions · Vercel

## Limites conhecidos

- Coordenadas das barbearias são aproximadas pelo endereço/bairro; logos reais não estão incluídas.
- Serviços, preços, profissionais e horários são dados acadêmicos, sem parceria real com as empresas. As parcerias e assinaturas das unidades de exemplo são de demonstração.
- Pagamento da assinatura fora do app (sem gateway); a ativação é manual.
- O Supabase no plano gratuito pausa o projeto depois de cerca de uma semana sem uso. Veja [Operação](docs/implantacao.md#operação).
