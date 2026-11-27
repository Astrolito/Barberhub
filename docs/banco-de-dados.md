# Banco de dados (Supabase)

PostgreSQL no Supabase, região São Paulo (`sa-east-1`). O esquema está em `supabase/migrations/`, aplicado em ordem:

| Migração | O que faz |
|---|---|
| `20261114000000_init.sql` | Tabelas do catálogo, perfis, horários e agendamentos; RLS; funções de reserva; Realtime |
| `20261114000100_endurecer_funcoes.sql` | Ajustes do Security Advisor (`search_path`, permissões de execução) |
| `20261123000000_melhorias.sql` | Acesso de barbeiro por lista de e-mails, avaliações, jornada configurável, remarcar, `Não compareceu`, serviços e unidade editáveis, Storage de fotos |
| `20261127000000_assinaturas_parcerias.sql` | Modelo de receita: planos, assinaturas com teste grátis, parcerias com preço diferenciado, visibilidade por assinatura em dia e funções de administração |
| `20261127100000_dono_barbearia.sql` | Dono da barbearia: equipe (convite por e-mail, remover barbeiro), agenda dos outros barbeiros, funções da unidade só do dono, barbeiro restrito à própria barbearia |

O catálogo inicial (barbearias, profissionais, serviços) está em `supabase/seed.sql`, gerado a partir de `src/data/seed.ts` com `node scripts/gerar-seed-sql.mjs`.

## Tabelas

Todas as 11 tabelas têm **Row Level Security ativa**.

| Tabela | Conteúdo | Leitura pela API | Escrita |
|---|---|---|---|
| `barbearias` | Unidades: nome, endereço, bairro, coordenadas, descrição, telefone, WhatsApp, foto de capa, `visivel_ate` | Pública | Só pelas funções do dono da unidade |
| `profissionais` | Barbeiros: nome, especialidades, unidade, foto, jornada, `ativo` (false = removido da equipe) | Pública | `salvar_jornada`, `salvar_profissional`, `remover_profissional` |
| `servicos` | Nome, preço, duração, categoria, disponível | Pública | Só por `salvar_servico` (dono) |
| `profiles` | Um por usuário do Auth: e-mail, nome, papel (`Cliente`/`Barbeiro`), `dono`, profissional e unidade vinculados, localização, raio, favoritos | Só o próprio | O próprio (papel, vínculos e `dono` protegidos por trigger) |
| `horarios` | Intervalos de cada profissional: início, fim, `Livre`/`Ocupado`/`Bloqueado` | Pública | Só pelas funções |
| `agendamentos` | Reservas: cliente (id, e-mail e nome), serviço, profissional, horário, status, preço e duração reservados | Cliente titular, barbeiro atribuído ou dono da unidade | Só pelas funções |
| `avaliacoes` | Nota de 1 a 5 e comentário (até 500 caracteres) de um atendimento finalizado | Pública | Só por `avaliar_atendimento` |
| `acessos_profissionais` | Lista de e-mails que viram Barbeiro, com o profissional vinculado e a marca `dono` | **Nenhuma** (sem policies); o dono vê a da equipe por `minha_equipe()` | `salvar_profissional` / `remover_profissional` (dono) ou SQL |
| `planos` | Básico, Profissional, Premium: preço mensal, limite de barbeiros (0 = sem limite), descrição | Pública (só ativos) | Painel do Supabase / SQL |
| `assinaturas` | Uma por barbearia: plano, status (`Teste`, `Ativa`, `Pendente`, `Cancelada`), início, `valida_ate` | Só o dono da unidade | `escolher_plano`, `cancelar_assinatura` e `admin_confirmar_pagamento` |
| `parcerias` | Desconto (10 a 30%), dias (30 ou 90), status (`Solicitada`, `Ativa`, `Recusada`, `Cancelada`, `Encerrada`), início e fim | Em vigor: pública. Todas da unidade: o dono dela | `solicitar_parceria`, `encerrar_parceria` e `admin_aprovar_parceria` / `admin_recusar_parceria` |

Status de agendamento: `Confirmado`, `Cancelado`, `Finalizado`, `Não compareceu` (e `Indisponível`, legado do Glide).

Um índice único parcial (`agendamento_ativo_por_horario`) impede duas reservas `Confirmado` no mesmo horário, mesmo com acessos simultâneos.

## Assinaturas e parcerias

**Assinatura.** Toda barbearia nova ganha, pelo trigger `barbearias_teste`, 30 dias de `Teste` no plano Básico. "Vencida" não é gravada: é qualquer assinatura com `valida_ate` no passado.

- Durante o teste, `escolher_plano` só troca o plano. Fora do teste (ou para renovar), o plano fica `Pendente` até a equipe confirmar o pagamento com `admin_confirmar_pagamento`, que muda para `Ativa` e soma os meses pagos ao prazo.
- `cancelar_assinatura` marca `Cancelada`; a unidade continua no ar até `valida_ate`.
- O plano não aceita equipe maior que o limite de barbeiros.

**Visibilidade (RN08).** O trigger `assinaturas_visibilidade` copia `valida_ate` para `barbearias.visivel_ate`, que é pública. O app só mostra na busca e no mapa as barbearias com `visivel_ate` no futuro, sem precisar ler a tabela de assinaturas. O trigger `agendamentos_regras_barbearia` recusa reservas e remarcações para unidades fora do prazo.

**Parceria (RN09).** O barbeiro pede com `solicitar_parceria(desconto, dias)` (exige assinatura em dia e nenhuma parceria aberta; um índice único garante uma só). A equipe aprova com `admin_aprovar_parceria`, que começa a contar na hora. Enquanto `Ativa` e dentro do período, a parceria é pública e o mesmo trigger de reservas grava o `preco_reservado` já com o desconto. `encerrar_parceria` cancela o pedido ou encerra antes do fim. A ordem da busca não muda: o destaque é a seção "Parceiras BarberHUB", o selo e o pino dourado.

As funções `admin_*` não podem ser executadas pela API (nem `anon` nem `authenticated`); rode no SQL Editor. Exemplos em [implantacao.md](implantacao.md#cobrança-e-parcerias).

## Papel de barbeiro e dono

O papel é definido **no primeiro login**, pelo trigger `handle_new_user` em `auth.users`:

1. Procura o e-mail (em minúsculas) em `acessos_profissionais`.
2. Se achar (e o profissional estiver ativo), cria o perfil como `Barbeiro`, vinculado ao profissional e à unidade dele, com `dono` igual ao da lista.
3. Se não, cria como `Cliente`.

Quando o dono convida, troca ou tira um e-mail pela tela **Equipe**, a função `sincronizar_acesso` aplica a mudança na hora a quem já tem conta: vira `Barbeiro` da unidade, ou volta a `Cliente`. O trigger `proteger_perfil` impede que o próprio usuário altere papel, vínculos e `dono`.

**Dono.** `acessos_profissionais.dono = true` (copiado para `profiles.dono`). Hoje a dona da Procópio (bb001) é a conta de teste `nicolasduarte.s+barbeiro@gmail.com` (prof-003). O dono:

- gerencia a equipe (`salvar_profissional`, `remover_profissional`, `minha_equipe`), respeitando o limite de barbeiros do plano;
- ajusta a jornada e bloqueia horários de qualquer barbeiro ativo da unidade (`exigir_gestao_profissional`);
- vê as reservas de toda a unidade (policy "reservas da unidade (dono)") e encerra qualquer atendimento dela;
- é o único que edita serviços, dados e foto da unidade, plano e parceria (`meu_perfil_dono`), e que lê `assinaturas` e os pedidos em `parcerias`.

O barbeiro comum cuida só da própria agenda e dos próprios atendimentos. Qualquer conta de barbeiro só reserva na própria barbearia (trigger `regras_reserva_barbearia`); o app também esconde as outras unidades dela.

Para dar acesso de dono a outra conta, veja [implantacao.md](implantacao.md#dar-acesso-de-barbeiro).

A tabela `acessos_profissionais` não tem policies: nem `anon` nem `authenticated` a leem. Antes o e-mail ficava em `profissionais.email_acesso`, legível pela API pública; a migração de 23/11 moveu para cá e removeu a coluna.

## Funções de regra

Horários, reservas, avaliações, serviços e dados da unidade só mudam por funções `security definer`, que travam a linha e aplicam as regras no mesmo commit. São executáveis apenas por `authenticated`.

| Função | Quem | O que faz |
|---|---|---|
| `preparar_horarios(profissional, dia)` | Qualquer usuário logado | Cria os horários do dia a partir da jornada |
| `confirmar_agendamento(horario, servico)` | Cliente | Reserva um horário livre (RN01, RN02) |
| `remarcar_agendamento(id, horario)` | Titular | Troca o horário, até 2h antes (RN03) |
| `cancelar_agendamento(id)` | Titular | Cancela até 2h antes e libera o horário (RN03) |
| `encerrar_atendimento(id, resultado)` | Barbeiro atribuído ou dono | `Finalizado` ou `Não compareceu`, depois do início (RN04) |
| `avaliar_atendimento(id, nota, comentario)` | Titular | Avalia um atendimento finalizado (RN05) |
| `alternar_bloqueio(horario)` | Barbeiro do horário ou dono | `Livre` ↔ `Bloqueado` |
| `salvar_jornada(jornada, profissional?)` | Barbeiro (a própria) ou dono (de alguém da equipe) | Dias, início, fim e duração do intervalo |
| `salvar_servico(servico)` | Dono | Cria ou edita serviço da própria unidade |
| `atualizar_barbearia(descricao, telefone, whatsapp)` | Dono | Dados da própria unidade |
| `atualizar_foto_barbearia(barbearia, foto)` | Dono | Foto de capa da própria unidade |
| `escolher_plano(plano)` | Dono | Assina, troca ou renova o plano da unidade (RF15, RF16) |
| `cancelar_assinatura()` | Dono | Cancela; a unidade segue no ar até o fim do prazo (RF16) |
| `solicitar_parceria(desconto, dias)` | Dono | Pede a parceria com o preço diferenciado (RF17) |
| `encerrar_parceria(id)` | Dono | Cancela o pedido ou encerra a parceria em vigor |
| `minha_equipe()` | Dono | Equipe ativa com e-mail de acesso, se já tem conta e quem é dono |
| `salvar_profissional(profissional)` | Dono | Adiciona ou edita barbeiro; o e-mail é o convite (RF19) |
| `remover_profissional(id)` | Dono | Tira da equipe: `ativo = false`, sem acesso, horários livres futuros removidos (RN11) |
| `admin_confirmar_pagamento(barbearia, meses)` | Equipe (SQL Editor) | Assinatura `Ativa` e prazo somado |
| `admin_aprovar_parceria(id)` / `admin_recusar_parceria(id)` | Equipe (SQL Editor) | Analisa o pedido de parceria |

Funções auxiliares: `meu_profissional_id()` (usada pela policy de `agendamentos`), `minha_barbearia_dono()` (policies do dono em `agendamentos`, `assinaturas`, `parcerias` e Storage), `minha_barbearia_id()`, `meu_perfil_barbeiro()`, `meu_perfil_dono()`, `exigir_gestao_profissional()`, `sincronizar_acesso()`, `jornada_padrao()`, `minutos_do_dia()`, `normalizar_telefone()`, e os triggers `handle_new_user`, `proteger_perfil`, `iniciar_teste`, `sincronizar_visibilidade` e `regras_reserva_barbearia`.

## Storage

Bucket público `fotos` (até 1 MB, JPEG/PNG/WebP):

- `perfis/<id do usuário>/` — cada usuário grava só na própria pasta.
- `barbearias/<id da unidade>/` — só o dono daquela unidade grava.

## Realtime

Publicação `supabase_realtime` com `horarios`, `agendamentos`, `barbearias`, `profissionais`, `servicos`, `avaliacoes`, `assinaturas` e `parcerias`. O app aplica só a linha alterada, sem recarregar tudo. A RLS continua valendo: cada pessoa só recebe as reservas que pode ler.

## Observação

Um `select` anônimo em `agendamentos` retorna erro (a policy chama `meu_profissional_id()`, que `anon` não executa). O app só consulta reservas com usuário logado, então isso não aparece para quem usa.
