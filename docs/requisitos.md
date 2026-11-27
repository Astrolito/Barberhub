# Requisitos do sistema

Requisitos funcionais, não funcionais, de negócio, de sistema e de usuário do BarberHUB, app de descoberta e agendamento de barbearias em Manaus. Versão de novembro de 2026, alinhada à apresentação "Requisitos do sistema".

Equipe: Renatto Gabriel (PO) · Nicolas Duarte (Dev) · Sávio Santos (QA) · Yan Félix (Docs)

**Resumo:** 60 requisitos — 18 funcionais, 8 não funcionais, 14 de negócio (5 objetivos e 9 regras), 8 de sistema e 12 de usuário. O modelo de receita (assinatura mensal e parceria) entrou em 27/11/2026: RN-O5, RF15 a RF18, RN08, RN09, RS08, RU11 e RU12.

## 1. Requisitos funcionais

O que o sistema deve fazer. Cada RF atende a um ou mais requisitos de usuário (seção 5).

### Cliente

| ID | O sistema deve permitir ao cliente… |
|---|---|
| RF01 | Entrar sem senha, por link ou código de 6 dígitos enviado por e-mail |
| RF02 | Listar barbearias pela distância, com raio de 1, 3, 5, 10, 20 km ou sem limite |
| RF03 | Ver as barbearias próximas no mapa do Início, com a pesquisa integrada (barbearia, bairro ou endereço), e definir a localização por GPS, endereço ou bairro |
| RF04 | Ver a unidade: serviços, preços, profissionais, avaliações, WhatsApp e telefone |
| RF05 | Agendar escolhendo serviço, profissional, data (próximos 14 dias) e horário livre |
| RF06 | Remarcar ou cancelar a reserva, e adicioná-la ao Google Agenda ou .ics |
| RF07 | Receber lembrete 1h antes, favoritar unidades, avaliar o atendimento e ver o histórico |

### Barbeiro

A conta de barbeiro enxerga só a própria barbearia (no Início, no mapa, nos favoritos e para reservar).

| ID | O sistema deve permitir ao barbeiro… |
|---|---|
| RF08 | Configurar a jornada: dias, início, fim e duração do intervalo (30 a 120 min) |
| RF09 | Gerar os horários do dia automaticamente a partir da jornada |
| RF10 | Bloquear e liberar horários livres da própria agenda |
| RF11 | Ver os atendimentos com o nome do cliente e encerrar como Finalizado ou Não compareceu |
| RF12 | Acompanhar o painel: atendimentos do dia e da semana, faturado no mês, nota média |

### Dono da barbearia

O dono também é barbeiro da unidade (tem a própria agenda) e, além disso, gerencia a barbearia.

| ID | O sistema deve permitir ao dono… |
|---|---|
| RF13 | Cadastrar e editar serviços com nome, preço e duração |
| RF14 | Editar a unidade: descrição, contato, horário de atendimento e foto de capa |
| RF15 | Assinar um plano mensal, começando com 30 dias de teste grátis |
| RF16 | Ver a situação da assinatura (em teste, ativa, aguardando pagamento, cancelada, vencida), trocar de plano, renovar ou cancelar |
| RF17 | Aderir à parceria BarberHUB, definindo o preço diferenciado (10% a 30% de desconto pelo app) e o período (30 ou 90 dias) |
| RF19 | Gerenciar a equipe: adicionar, editar e remover barbeiros (dentro do limite do plano) e convidá-los pelo e-mail de acesso |
| RF20 | Ajustar a jornada e bloquear ou liberar horários de qualquer barbeiro da equipe |
| RF21 | Ver as reservas de toda a unidade e encerrar atendimentos de qualquer barbeiro |

### Cliente (parcerias)

| ID | O sistema deve permitir ao cliente… |
|---|---|
| RF18 | Ver as barbearias parceiras em destaque (seção "Parceiras BarberHUB" no Início, selo "Parceira" no catálogo, no mapa e na unidade) e agendar com o preço diferenciado |

## 2. Requisitos não funcionais

Como o sistema deve se comportar.

| ID | Categoria | O sistema deve… |
|---|---|---|
| RNF01 | Segurança | Restringir cada usuário aos próprios dados e reservas |
| RNF02 | Integridade | Impedir duas reservas no mesmo horário, mesmo com acessos simultâneos |
| RNF03 | Desempenho | Mostrar uma reserva nova na agenda do barbeiro em até 2 segundos, sem recarregar |
| RNF04 | Usabilidade | Estar em português e permitir agendar em até 1 minuto |
| RNF05 | Disponibilidade | Ficar no ar 24 horas e avisar quando o aparelho estiver sem internet |
| RNF06 | Portabilidade | Rodar no navegador, no Android e no iOS com o mesmo código |
| RNF07 | Privacidade | Não guardar dados de cartão; o pagamento é no local |
| RNF08 | Manutenção | Ter as regras cobertas por testes automáticos a cada alteração |

## 3. Requisitos de negócio

### Objetivos

| ID | Objetivo | Meta |
|---|---|---|
| RN-O1 | Agilidade | Marcar um horário em menos de 1 minuto (hoje depende de ligação ou WhatsApp) |
| RN-O2 | Menos faltas | Reduzir em 20% as faltas, com lembrete e remarcação pelo próprio cliente |
| RN-O3 | Ocupação | Agenda aberta 24 horas, para clientes acharem horários livres mesmo com a barbearia fechada |
| RN-O4 | Custo | Sem taxa por atendimento: o cliente paga no local e a infraestrutura usa planos gratuitos |
| RN-O5 | Receita | Receita recorrente com a assinatura mensal das barbearias, e parcerias que trazem clientes com preço diferenciado |

### Regras de negócio

| ID | Regra |
|---|---|
| RN01 | Só se reserva horário Livre e futuro, e o serviço precisa caber no intervalo |
| RN02 | Cada cliente tem no máximo 3 reservas futuras e nenhuma no mesmo horário |
| RN03 | Cancelar ou remarcar só até 2h antes; o horário antigo volta a Livre |
| RN04 | Só o barbeiro atribuído (ou o dono da unidade) encerra, e só depois do início do atendimento |
| RN05 | Só o titular avalia (nota de 1 a 5), e só atendimentos Finalizados |
| RN06 | Jornada padrão: Seg a Sáb, 10:00 às 17:30, intervalos de 90 min; raio padrão de 5 km |
| RN07 | Pagamento do atendimento feito no estabelecimento, em dinheiro, Pix ou cartão |
| RN08 | A barbearia só aparece na busca e no mapa, e só recebe reservas novas, com assinatura em teste ou paga dentro do prazo. Cancelada, segue no ar até o fim do período |
| RN10 | Conta de barbeiro só vê e só reserva na própria barbearia. Só o dono mexe em serviços, dados da unidade, plano, parceria e equipe; o barbeiro comum cuida só da própria agenda |
| RN11 | Barbeiro removido sai do catálogo e perde o acesso (volta a Cliente); reservas antigas e avaliações ficam. Não se remove quem tem reserva confirmada, nem o próprio dono |
| RN09 | A parceira só fica em destaque enquanto oferece o preço diferenciado (parceria aprovada e dentro do período), sempre com o selo "Parceira". A ordem da busca continua sendo a distância |

### Modelo de receita

A busca é por localização, então não há "anúncio pago no topo": a lista e o mapa seguem da mais próxima para a mais distante. A plataforma ganha com duas frentes:

| Frente | Como funciona | Valores de referência |
|---|---|---|
| **Assinatura mensal** | Toda barbearia paga um plano para usar o app (agenda online, mapa, lembretes, avaliações). Começa com 30 dias de teste grátis. | Básico R$ 49,90 (até 2 barbeiros) · Profissional R$ 89,90 (até 5) · Premium R$ 149,90 (ilimitado) |
| **Parceria BarberHUB** | A barbearia oferece desconto em todos os serviços agendados pelo app. Em troca, aparece na seção "Parceiras BarberHUB" do Início, com selo "Parceira" e pino dourado no mapa. Traz clientes novos para ela e usuários para a plataforma. | Desconto de 10% a 30%, por 30 ou 90 dias; aprovação da equipe |

Não há gateway de pagamento no app: a equipe envia a cobrança (Pix ou boleto) e confirma o pagamento no painel. Os valores são de referência para o projeto e podem mudar sem alterar o código (tabela `planos`).

## 4. Requisitos de sistema

### Arquitetura

- **Interface:** React 18, TypeScript, Vite e Tailwind. Telas → estado → regras → repositório.
- **Backend:** Supabase — PostgreSQL com RLS, Auth por e-mail, Realtime e Storage de fotos. Região São Paulo.
- **Entrega:** site em produção na Vercel; app Android e iOS pelo Capacitor, com GPS e notificações nativas.
- Mapa com Leaflet + OpenStreetMap · 11 tabelas no banco · 18 funções SQL de regra (e 3 de administração) · CI com GitHub Actions + Vitest.

Detalhes em [arquitetura.md](arquitetura.md) e [banco-de-dados.md](banco-de-dados.md).

### Especificação técnica

| ID | Tipo | O sistema deve… |
|---|---|---|
| RS01 | Dados | Armazenar as reservas na tabela `agendamentos`, ligada a `horarios` e `profiles` |
| RS02 | Dados | Guardar as fotos no Storage, uma pasta por usuário e por unidade |
| RS03 | Regras | Confirmar, remarcar e cancelar em funções SQL que travam o horário |
| RS04 | Integração | Autenticar por e-mail, com link ou código, pelo Supabase Auth |
| RS05 | Integração | Converter endereço em coordenadas pelo OpenStreetMap (Nominatim) |
| RS06 | Interface | Usar GPS e notificações do aparelho por plugins do Capacitor |
| RS07 | Interface | Atualizar as telas pelo Supabase Realtime quando uma reserva mudar |
| RS08 | Dados | Guardar planos, assinaturas (plano, status, validade) e parcerias (desconto, início, fim, status) nas tabelas `planos`, `assinaturas` e `parcerias` |

## 5. Requisitos de usuário

| Como cliente, quero… | Como barbeiro, quero… |
|---|---|
| **RU01** achar uma barbearia perto de mim | **RU06** definir meus dias e horários de trabalho |
| **RU02** ver preço e duração antes de marcar | **RU07** ver quem vem hoje, com o nome do cliente |
| **RU03** agendar sem ligar e ser lembrado antes | **RU08** bloquear um horário quando não puder atender |
| **RU04** remarcar se surgir um imprevisto | **RU09** registrar quem faltou |
| **RU05** avaliar e ver a nota dos outros | **RU10** saber quanto faturei no mês |
| **RU12** encontrar parceiras com preço especial | **RU11** assinar um plano e virar parceira para atrair clientes |
| | **RU13** (dono) montar e gerenciar a equipe e a agenda de cada barbeiro |

## 6. Rastreabilidade

Negócio e usuário originam os funcionais e não funcionais; o sistema detalha a implementação.

| Negócio | Usuário | Funcional | Não funcional | Sistema |
|---|---|---|---|---|
| RN-O1 Agilidade | RU01, RU02, RU03 | RF02 a RF05 | RNF03, RNF04 | RS01, RS05 |
| RN-O2 Menos faltas | RU03, RU04, RU09 | RF06, RF07, RF11 | RNF05 | RS03, RS06 |
| RN-O3 Ocupação | RU05 a RU08 | RF07 a RF10 | RNF02 | RS03, RS07 |
| RN-O4 Custo | RU10 | RF12 a RF14 | RNF07 | RS02, RS04 |
| RN-O5 Receita | RU11, RU12 | RF15 a RF18 | RNF01, RNF07 | RS08 |
| RN-O3 Ocupação | RU13 | RF19 a RF21 | RNF01 | RS03 |

## 7. Onde cada regra está no código

| Regra | Cliente (`src/domain/rules.ts`) | Servidor (SQL) |
|---|---|---|
| RN01, RN02 | confirmar | `confirmar_agendamento` + índice `agendamento_ativo_por_horario` |
| RN03 | cancelar, remarcar | `cancelar_agendamento`, `remarcar_agendamento` |
| RN04 | encerrar | `encerrar_atendimento` |
| RN05 | avaliar | `avaliar_atendimento` |
| RN06 | jornada padrão, raio padrão | `jornada_padrao`, `preparar_horarios` |
| RN08 | `barbeariaVisivel`, confirmar, remarcar | trigger `regras_reserva_barbearia` + `barbearias.visivel_ate` |
| RN09 | `parceriaVigente`, `precoNoApp` | policy "parcerias em vigor" + desconto em `regras_reserva_barbearia` |
| RF15, RF16 | `escolherPlano`, `cancelarAssinatura` | `escolher_plano`, `cancelar_assinatura` |
| RF17 | `solicitarParceria`, `encerrarParceria` | `solicitar_parceria`, `encerrar_parceria` |
| RF19, RN11 | `salvarProfissional`, `removerProfissional`, `equipeDe` | `salvar_profissional`, `remover_profissional`, `minha_equipe` |
| RF20 | `salvarJornada`, `alternarBloqueio`, `podeGerir` | `salvar_jornada(jornada, profissional)`, `alternar_bloqueio`, `exigir_gestao_profissional` |
| RN10 | `barbeariaPermitida`, `ehDono` | `meu_perfil_dono`, policies "(dono)", trigger `regras_reserva_barbearia` |
| RNF01 | — | RLS nas 11 tabelas |
| RNF08 | `rules.test.ts` | CI no GitHub Actions |
