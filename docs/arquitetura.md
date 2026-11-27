# Arquitetura

## Visão geral

```
 Navegador / webview Capacitor
 ┌──────────────────────────────────────────────┐
 │ pages/ (telas)                               │
 │   ↓                                          │
 │ state/AppContext.tsx (sessão, ações, toasts) │
 │   ↓                                          │
 │ domain/rules.ts (regras puras, testadas)     │
 │   ↓                                          │
 │ data/backend.ts → backendLocal | Supabase    │
 └──────────────────────────────────────────────┘
          │ HTTPS (supabase-js)        │ HTTPS
          ▼                            ▼
 Supabase (sa-east-1)          OpenStreetMap
  Auth · Postgres+RLS ·         tiles do mapa ·
  Realtime · Storage            Nominatim (geocodificação)
```

- **Telas → estado → regras → repositório.** As telas não falam com o banco; chamam ações do `AppContext`, que aplicam `domain/rules.ts` e persistem pelo backend ativo.
- **Dois backends com a mesma interface** (`src/data/backend.ts`): `backendLocal.ts` grava no `localStorage` (modo demonstração) e `backendSupabase.ts` usa o Supabase quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem.
- **No modo Supabase as regras rodam também no servidor**, nas funções SQL (veja [banco-de-dados.md](banco-de-dados.md)). O cliente valida para dar resposta rápida; o servidor é quem decide.

## Pastas

```
src/
  domain/
    types.ts        Entidades do UML: Usuario, Barbearia, Profissional, Servico, Horario, Agendamento
    rules.ts        Regras de negócio puras: preparar horários, confirmar, remarcar, cancelar,
                    encerrar, bloquear/liberar, limites (2h, 3 reservas futuras), raio de busca
    rules.test.ts   Testes das regras (Vitest, fuso America/Manaus)
  data/
    seed.ts         Catálogo de Manaus, serviços, profissionais, opções de distância
    repository.ts   Interface do repositório
    backend.ts      Escolhe o backend pelo ambiente
    backendLocal.ts Modo demonstração (localStorage)
    backendSupabase.ts  Auth, consultas, RPC das funções SQL, Realtime, upload de fotos
  state/
    AppContext.tsx  Estado global, sessão, ações, toasts
  lib/              Formatação pt-BR, geolocalização e distância, geocodificação, calendário (.ics),
                    lembretes (notificações locais), ids, redimensionar imagem
  components/       UI base (botões, sheet, switch, linhas), tab bar, menu lateral, ícones
  pages/            Telas do cliente; pages/barbeiro/ para a Área do barbeiro
supabase/
  migrations/       Esquema, RLS e funções (aplicar em ordem)
  seed.sql          Catálogo inicial (gerado por scripts/gerar-seed-sql.mjs a partir de seed.ts)
android/            Projeto Android do Capacitor
```

## Rotas

Roteamento com `HashRouter`, que funciona em hospedagem estática e dentro do webview.

| Rota | Tela |
|---|---|
| `/entrar` | Login (e-mail com link ou código; contas de demonstração no modo local) |
| `/` | Início: catálogo por distância e próximo agendamento |
| `/mapa` | Mapa de barbearias próximas |
| `/favoritos`, `/agendamentos`, `/perfil` | Abas da tab bar |
| `/barbearia/:id`, `/servico/:id`, `/profissional/:id` | Detalhes do catálogo |
| `/agendar/:horarioId`, `/agendamento/:id` | Revisão da reserva e detalhe (remarcar, cancelar, avaliar) |
| `/perfil/dados`, `/perfil/pagamentos`, `/perfil/historico` | Perfil |
| `/barbeiro` e `/barbeiro/{barbearia,atendimentos,horarios,agenda,servicos}` | Área do barbeiro |
| `/ajuda`, `/sobre` | Informações |

As rotas da Área do barbeiro só mostram conteúdo para perfis com papel `Barbeiro`; o servidor também recusa as funções de barbeiro para quem não tem esse papel.

## Mapa de barbearias próximas

`src/pages/Mapa.tsx`, com Leaflet.

- Tiles do OpenStreetMap (`tile.openstreetmap.org`, sem chave de API). O tema escuro vem de um filtro CSS na classe `.bh-tiles` (`src/index.css`). Os tiles do CARTO foram trocados porque passaram a exigir chave.
- Usa o mesmo ponto de busca (`localizacao`) e raio (`raioBuscaKm`) do catálogo, então mudar um muda o outro.
- Desenha o ponto do usuário e um círculo com o raio; mostra só as barbearias dentro dele (ou todas, com "Sem limite"), da mais próxima para a mais distante.
- O enquadramento só muda quando o ponto de busca ou o raio mudam, não ao tocar num marcador.

A localização vem do GPS (`@capacitor/geolocation` no app nativo, API do navegador na web), de um endereço geocodificado pelo Nominatim (`src/lib/geo.ts`) ou de um bairro de Manaus como alternativa.

## Máquinas de estado (UML 03)

**Agendamento**

- Envio → `Confirmado`, se o horário está `Livre` e no futuro, o serviço cabe no intervalo, o cliente tem menos de 3 reservas futuras e nenhuma outra no mesmo horário. Senão o envio é recusado e nada é gravado.
- `Confirmado` → `Cancelado` ou remarcado: só o titular, até 2h antes. O horário antigo volta a `Livre`.
- `Confirmado` → `Finalizado` ou `Não compareceu`: só o barbeiro atribuído, depois do início. O horário continua `Ocupado`.
- `Finalizado` pode receber uma avaliação de 1 a 5 do titular.

**Horário**

- `Livre` ↔ `Bloqueado` (barbeiro do intervalo); `Livre` → `Ocupado` (confirmação); `Ocupado` → `Livre` (cancelamento ou remarcação).

**Agenda do profissional**

- Cada profissional define dias, início, fim e duração do intervalo (padrão Seg a Sáb, 10:00 às 17:30, 90 min).
- Ao abrir um dia, os horários faltantes são criados; livres fora da jornada saem (ou ficam `Bloqueados` se já tiveram reserva).

Os limites (2h para cancelar/remarcar, 3 reservas futuras) estão em `src/domain/rules.ts` **e** na migração `20261123000000_melhorias.sql`. Mude nos dois.

## Integrações

| Serviço | Uso |
|---|---|
| Supabase Auth | Login sem senha por e-mail (magic link e código de 6 dígitos) |
| Supabase Postgres | Dados, RLS e funções de regra |
| Supabase Realtime | Telas atualizam sozinhas quando horários, reservas, serviços ou avaliações mudam |
| Supabase Storage | Bucket público `fotos` para fotos de perfil e capas de unidades |
| OpenStreetMap | Tiles do mapa e geocodificação (Nominatim) |
| Capacitor | GPS (`@capacitor/geolocation`) e lembrete 1h antes (`@capacitor/local-notifications`) |
| Google Agenda / `.ics` | Adicionar a reserva ao calendário (`src/lib/calendario.ts`) |

## Estilo e interação

Tailwind com os tokens do tema em `tailwind.config.js` (bg, surface, brand `#1d6fe0` etc.). Interações no estilo Emil Kowalski: feedback de pressão, bottom sheet arrastável, toasts, transições curtas com ease-out e respeito a `prefers-reduced-motion`.

## Qualidade

`.github/workflows/ci.yml` roda a cada pull request e a cada push na `main`: `npm ci`, `npm test` (regras de agendamento) e `npm run build` (tipos + build).
