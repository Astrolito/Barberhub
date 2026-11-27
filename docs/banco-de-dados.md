# Banco de dados (Supabase)

PostgreSQL no Supabase, região São Paulo (`sa-east-1`). O esquema está em `supabase/migrations/`, aplicado em ordem:

| Migração | O que faz |
|---|---|
| `20261114000000_init.sql` | Tabelas do catálogo, perfis, horários e agendamentos; RLS; funções de reserva; Realtime |
| `20261114000100_endurecer_funcoes.sql` | Ajustes do Security Advisor (`search_path`, permissões de execução) |
| `20261123000000_melhorias.sql` | Acesso de barbeiro por lista de e-mails, avaliações, jornada configurável, remarcar, `Não compareceu`, serviços e unidade editáveis, Storage de fotos |

O catálogo inicial (barbearias, profissionais, serviços) está em `supabase/seed.sql`, gerado a partir de `src/data/seed.ts` com `node scripts/gerar-seed-sql.mjs`.

## Tabelas

Todas as 8 tabelas têm **Row Level Security ativa**.

| Tabela | Conteúdo | Leitura pela API | Escrita |
|---|---|---|---|
| `barbearias` | Unidades: nome, endereço, bairro, coordenadas, descrição, telefone, WhatsApp, foto de capa | Pública | Só pelas funções do barbeiro da unidade |
| `profissionais` | Barbeiros: nome, especialidades, unidade, foto, jornada | Pública | Só por `salvar_jornada` |
| `servicos` | Nome, preço, duração, categoria, disponível | Pública | Só por `salvar_servico` |
| `profiles` | Um por usuário do Auth: e-mail, nome, papel (`Cliente`/`Barbeiro`), profissional e unidade vinculados, localização, raio, favoritos | Só o próprio | O próprio (papel e vínculos protegidos por trigger) |
| `horarios` | Intervalos de cada profissional: início, fim, `Livre`/`Ocupado`/`Bloqueado` | Pública | Só pelas funções |
| `agendamentos` | Reservas: cliente (id, e-mail e nome), serviço, profissional, horário, status, preço e duração reservados | Cliente titular ou barbeiro atribuído | Só pelas funções |
| `avaliacoes` | Nota de 1 a 5 e comentário (até 500 caracteres) de um atendimento finalizado | Pública | Só por `avaliar_atendimento` |
| `acessos_profissionais` | Lista de e-mails que viram Barbeiro, com o profissional vinculado | **Nenhuma** (sem policies) | Painel do Supabase / SQL |

Status de agendamento: `Confirmado`, `Cancelado`, `Finalizado`, `Não compareceu` (e `Indisponível`, legado do Glide).

Um índice único parcial (`agendamento_ativo_por_horario`) impede duas reservas `Confirmado` no mesmo horário, mesmo com acessos simultâneos.

## Papel de barbeiro

O papel é definido **no primeiro login**, pelo trigger `handle_new_user` em `auth.users`:

1. Procura o e-mail (em minúsculas) em `acessos_profissionais`.
2. Se achar, cria o perfil como `Barbeiro`, vinculado ao profissional e à unidade dele.
3. Se não, cria como `Cliente`.

O trigger `proteger_perfil` impede que o próprio usuário altere papel e vínculos. Por isso o e-mail precisa estar na lista **antes** do primeiro login; para promover quem já tem conta, veja [implantacao.md](implantacao.md#dar-acesso-de-barbeiro).

A tabela `acessos_profissionais` não tem policies: nem `anon` nem `authenticated` a leem. Antes o e-mail ficava em `profissionais.email_acesso`, legível pela API pública; a migração de 23/11 moveu para cá e removeu a coluna.

## Funções de regra

Horários, reservas, avaliações, serviços e dados da unidade só mudam por funções `security definer`, que travam a linha e aplicam as regras no mesmo commit. São executáveis apenas por `authenticated`.

| Função | Quem | O que faz |
|---|---|---|
| `preparar_horarios(profissional, dia)` | Qualquer usuário logado | Cria os horários do dia a partir da jornada |
| `confirmar_agendamento(horario, servico)` | Cliente | Reserva um horário livre (RN01, RN02) |
| `remarcar_agendamento(id, horario)` | Titular | Troca o horário, até 2h antes (RN03) |
| `cancelar_agendamento(id)` | Titular | Cancela até 2h antes e libera o horário (RN03) |
| `encerrar_atendimento(id, resultado)` | Barbeiro atribuído | `Finalizado` ou `Não compareceu`, depois do início (RN04) |
| `avaliar_atendimento(id, nota, comentario)` | Titular | Avalia um atendimento finalizado (RN05) |
| `alternar_bloqueio(horario)` | Barbeiro do horário | `Livre` ↔ `Bloqueado` |
| `salvar_jornada(jornada)` | Barbeiro | Dias, início, fim e duração do intervalo |
| `salvar_servico(servico)` | Barbeiro | Cria ou edita serviço da própria unidade |
| `atualizar_barbearia(descricao, telefone, whatsapp)` | Barbeiro | Dados da própria unidade |
| `atualizar_foto_barbearia(barbearia, foto)` | Barbeiro | Foto de capa da própria unidade |

Funções auxiliares: `meu_profissional_id()` (usada pela policy de `agendamentos`), `meu_perfil_barbeiro()`, `jornada_padrao()`, `minutos_do_dia()`, `normalizar_telefone()`, e os triggers `handle_new_user` e `proteger_perfil`.

## Storage

Bucket público `fotos` (até 1 MB, JPEG/PNG/WebP):

- `perfis/<id do usuário>/` — cada usuário grava só na própria pasta.
- `barbearias/<id da unidade>/` — só o barbeiro daquela unidade grava.

## Realtime

Publicação `supabase_realtime` com `horarios`, `agendamentos`, `barbearias`, `profissionais`, `servicos` e `avaliacoes`. O app aplica só a linha alterada, sem recarregar tudo. A RLS continua valendo: cada pessoa só recebe as reservas que pode ler.

## Observação

Um `select` anônimo em `agendamentos` retorna erro (a policy chama `meu_profissional_id()`, que `anon` não executa). O app só consulta reservas com usuário logado, então isso não aparece para quem usa.
