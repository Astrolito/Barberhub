# BarberHUB

App web e mobile (webview) para descobrir barbearias em Manaus e agendar horários. Reconstrução em código do MVP feito no Glide, seguindo a Documentação técnica v1.4 e o UML de 06/10/2026, com o mesmo design base (preto/carvão + azul) e melhorias de interação.

## Rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # gera dist/ (web e Capacitor)
npm run build:single # gera dist-single/index.html, um arquivo único para prévia
npm run dev:https    # https na rede local, para testar o GPS no celular/tablet
```

Localização: o navegador só libera o GPS em `https` (ou `localhost`). Para testar no tablet pelo PC, use `npm run dev:https`, abra o endereço `https://IP-do-PC:5173` no tablet e aceite o aviso de certificado. Na prévia publicada no claude.ai o GPS fica bloqueado; use o bairro ou o endereço.

Contas de demonstração (tela de entrada):

| Conta | E-mail | O que faz |
|---|---|---|
| Cliente | `cliente@barberhub.app` | Explora, favorita, agenda, cancela |
| Barbeiro | `barbeiro@barberhub.app` | Igual ao cliente + Área do barbeiro (Renatto Gabriel, Procópio) |

Para zerar os dados: menu lateral > Sobre o BarberHUB > Restaurar dados de demonstração.

## Mobile (Android/iOS via Capacitor)

O app roda dentro de um webview nativo com Capacitor. A configuração está em `capacitor.config.ts` (`appId: br.com.barberhub.app`).

O projeto Android já está em `android/`, com as permissões de localização. No app nativo o GPS usa o plugin `@capacitor/geolocation`, que pede a permissão do sistema.

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

- Agendamento: envio → `Confirmado` (se horário Livre e futuro) ou `Indisponível`; `Confirmado` → `Cancelado` (cliente titular, horário volta a Livre) ou `Finalizado` (barbeiro atribuído, horário continua Ocupado).
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

## Limites conhecidos

- Os dados ficam no aparelho (localStorage); não há backend nem login real por e-mail ainda.
- Coordenadas das barbearias são aproximadas pelo endereço/bairro; logos reais não estão incluídas (a capa usa a identidade tipográfica até o barbeiro enviar uma foto).
- Serviços, preços, profissionais e horários são dados acadêmicos, sem parceria com as empresas.
