# BarberHUB

App web e mobile (webview) para descobrir barbearias em Manaus e agendar horários. Reconstrução em código do MVP feito no Glide, seguindo a Documentação técnica v1.4 e o UML de 06/10/2026, com o mesmo design base (preto/carvão + azul) e melhorias de interação.

## Rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # gera dist/ (web e Capacitor)
npm run build:single # gera dist-single/index.html, um arquivo único para prévia
npm run dev:https    # https na rede local, para testar o GPS no celular/tablet
npm test             # testes das regras de agendamento (também rodam no GitHub a cada PR)
```

Localização: o navegador só libera o GPS em `https` (ou `localhost`). Para testar no tablet pelo PC, use `npm run dev:https`, abra o endereço `https://IP-do-PC:5173` no tablet e aceite o aviso de certificado. Na prévia publicada no claude.ai o GPS fica bloqueado; use o bairro ou o endereço.

Contas de demonstração (tela de entrada):

| Conta | E-mail | O que faz |
|---|---|---|
| Cliente | `cliente@barberhub.app` | Explora, favorita, agenda, cancela |
| Barbeiro | `barbeiro@barberhub.app` | Igual ao cliente + Área do barbeiro (Renatto Gabriel, Procópio) |

Para zerar os dados: menu lateral > Sobre o BarberHUB > Restaurar dados de demonstração.

## Backend (Supabase) e publicação (Vercel)

O app tem dois modos, escolhidos pelas variáveis de ambiente (veja `.env.example`):

- **Demonstração** (sem variáveis): dados no aparelho, contas de demonstração.
- **Supabase** (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`): login sem senha por e-mail (link ou código), reservas compartilhadas e atualização em tempo real.

### Supabase

1. Crie um projeto e rode, no SQL Editor, os arquivos de `supabase/migrations/` em ordem e depois `supabase/seed.sql` (ou `supabase db push` com a CLI).
2. Em **Authentication > URL Configuration**, defina o *Site URL* como o domínio da Vercel e adicione-o em *Redirect URLs*.
3. Em **Authentication > Email Templates > Magic Link**, inclua `{{ .Token }}` no texto para o e-mail trazer também o código de 6 dígitos (necessário no app instalado).
4. Para ter acesso de barbeiro, cadastre o e-mail do profissional antes do primeiro login (a tabela não é lida pela API pública):
   `insert into acessos_profissionais (email, profissional_id) values ('seu@email.com', 'prof-001') on conflict (profissional_id) do update set email = excluded.email;`
   Quem entrar com esse e-mail vira Barbeiro vinculado à Procópio.

Segurança: catálogo e horários são públicos para leitura; cada pessoa só lê o próprio perfil e as reservas em que é cliente ou barbeiro (RLS). Horários, reservas, avaliações, serviços e dados da unidade só mudam pelas funções SQL (`confirmar_agendamento`, `remarcar_agendamento`, `cancelar_agendamento`, `encerrar_atendimento`, `avaliar_atendimento`, `alternar_bloqueio`, `preparar_horarios`, `salvar_jornada`, `salvar_servico`, `atualizar_barbearia`, `atualizar_foto_barbearia`), que travam a linha e aplicam as regras no mesmo commit. Um índice único impede duas reservas confirmadas no mesmo horário. Fotos ficam no bucket público `fotos` do Storage (`perfis/<id do usuário>/` e `barbearias/<id da unidade>/`, cada um só grava na própria pasta). Os limites (2h para cancelar/remarcar, 3 reservas futuras) estão em `src/domain/rules.ts` e na migração `20261123000000_melhorias.sql`; mude nos dois.

Se mudar `src/data/seed.ts`, gere o SQL de novo com `node scripts/gerar-seed-sql.mjs`.

### Vercel

Importe o repositório em vercel.com/new. O `vercel.json` já define o build (`npm run build`, saída `dist`). Em *Settings > Environment Variables*, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e faça um novo deploy. Sem elas, o site publica em modo demonstração.

## Mobile (Android/iOS via Capacitor)

O app roda dentro de um webview nativo com Capacitor. A configuração está em `capacitor.config.ts` (`appId: br.com.barberhub.app`).

O projeto Android já está em `android/`, com as permissões de localização e de notificação. No app nativo o GPS usa o plugin `@capacitor/geolocation`, e o lembrete 1h antes de cada reserva usa `@capacitor/local-notifications` (pede a permissão na primeira reserva).

```bash
npm run android       # build + sync + abre o Android Studio (depois: Run ▶)
npx cap add ios       # uma vez; requer macOS + Xcode
npm run ios           # build + sync + abre o Xcode
```

No iOS, adicione `NSLocationWhenInUseUsageDescription` no `Info.plist` depois do `cap add ios`.

## Arquitetura

```
src/
  domain/
    types.ts       Entidades do UML: Usuario, Barbearia, Profissional, Servico, Horario, Agendamento
    rules.ts       Regras de negócio puras (seção 5 da doc): preparar horários, confirmar,
                   cancelar, finalizar, bloquear/liberar, término do serviço
  data/
    seed.ts        Catálogo de Manaus, serviços, profissionais, opções de distância
    repository.ts  Interface Repositorio + implementação localStorage
  state/
    AppContext.tsx Estado global, sessão, ações (chamam as regras e persistem), toasts
  lib/             Formatação pt-BR, geolocalização/distância, ids, redimensionar imagem
  components/      UI base (botões, sheet, switch, linhas), tab bar, menu lateral, ícones
  pages/           Telas do cliente e pages/barbeiro/ para a área profissional
```

- **Camadas**: telas → `AppContext` → `domain/rules` (puro, testável) → `Repositorio`. Trocar localStorage por Supabase/Firebase/API significa implementar `Repositorio` e mover `rules.ts` para o servidor; as telas não mudam.
- **Roteamento**: `HashRouter`, que funciona em hospedagem estática e dentro do webview.
- **Estilo**: Tailwind com tokens do tema em `tailwind.config.js` (bg, surface, brand `#1d6fe0`, etc.).

### Máquinas de estado (UML 03)

- Agendamento: envio → `Confirmado` (horário Livre e futuro, serviço cabe no intervalo, cliente com menos de 3 reservas futuras e sem outra no mesmo horário; senão o envio é recusado e nada é gravado). `Confirmado` → `Cancelado` ou remarcado (cliente titular, até 2h antes; o horário antigo volta a Livre) ou, depois do início, `Finalizado` / `Não compareceu` (barbeiro atribuído; o horário continua Ocupado). `Finalizado` pode receber uma avaliação de 1 a 5 do titular.
- Agenda: cada profissional define dias, início, fim e duração do intervalo (padrão Seg a Sáb, 10:00 às 17:30, 90 min). Ao preparar um dia, faltantes são criados e livres fora da agenda saem (ou ficam Bloqueados se já tiveram reserva).
- Horário: `Livre` ↔ `Bloqueado` (barbeiro do intervalo); `Livre` → `Ocupado` (confirmação); `Ocupado` → `Livre` (cancelamento).

## Melhorias em relação ao Glide

- Término real do serviço exibido (início + duração), separado do fim do intervalo de 90 min (pendência da v1.4).
- Horários do dia preparados automaticamente ao escolher a data, com seletor rápido de 14 dias.
- Confirmação verifica e ocupa o horário no mesmo passo (sem janela entre checar e gravar).
- Logout real e direto no Perfil e no menu lateral.
- Atalho para a Área do barbeiro no Perfil (pendência da v1.4).
- Confirmação antes de cancelar, término e valor na revisão, cartão de "próximo agendamento" no Início.
- Catálogo ordenado pela distância, com o km em cada capa, e mensagem vazia com atalho para "Sem limite".
- Busca por endereço com geocodificação (OpenStreetMap) e fallback por bairro de Manaus.
- Interações no estilo Emil Kowalski: feedback de pressão, bottom sheet arrastável, toasts, transições curtas com ease-out, respeito a `prefers-reduced-motion`.

## Melhorias de 23/11/2026

- Regras: prazo de 2h para cancelar/remarcar, limite de 3 reservas futuras, sem reservas sobrepostas, finalizar só depois do início, status `Não compareceu`, tentativas recusadas não viram registro.
- Cliente: remarcar (inclusive trocando de barbeiro), Google Agenda / .ics, lembrete no app instalado, avaliações com nota no catálogo, agendar a partir do serviço, WhatsApp/telefone e horário de atendimento na página da unidade.
- Barbeiro: agenda configurável, painel (dia, semana, faturado no mês, nota, pendentes), serviços editáveis, descrição e contato da unidade, nome do cliente nos atendimentos.
- Segurança e desempenho: e-mail de acesso fora da API pública, fotos no Storage, Realtime aplica só a linha alterada, tela de erro e aviso sem internet, testes automáticos e CI.

## Limites conhecidos

- No modo demonstração os dados ficam no aparelho; no modo Supabase ficam no servidor.
- Coordenadas das barbearias são aproximadas pelo endereço/bairro; logos reais não estão incluídas (a capa usa a identidade tipográfica até o barbeiro enviar uma foto).
- Serviços, preços, profissionais e horários são dados acadêmicos, sem parceria com as empresas.
