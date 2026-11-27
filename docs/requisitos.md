# Requisitos do sistema

Requisitos funcionais, não funcionais, de negócio, de sistema e de usuário do BarberHUB, app de descoberta e agendamento de barbearias em Manaus. Versão de novembro de 2026, alinhada à apresentação "Requisitos do sistema".

Equipe: Renatto Gabriel (PO) · Nicolas Duarte (Dev) · Sávio Santos (QA) · Yan Félix (Docs)

**Resumo:** 50 requisitos — 14 funcionais, 8 não funcionais, 11 de negócio (4 objetivos e 7 regras), 7 de sistema e 10 de usuário.

## 1. Requisitos funcionais

O que o sistema deve fazer. Cada RF atende a um ou mais requisitos de usuário (seção 5).

### Cliente

| ID | O sistema deve permitir ao cliente… |
|---|---|
| RF01 | Entrar sem senha, por link ou código de 6 dígitos enviado por e-mail |
| RF02 | Listar barbearias pela distância, com raio de 1, 3, 5, 10, 20 km ou sem limite |
| RF03 | Ver as barbearias próximas no mapa e definir a localização por GPS, endereço ou bairro |
| RF04 | Ver a unidade: serviços, preços, profissionais, avaliações, WhatsApp e telefone |
| RF05 | Agendar escolhendo serviço, profissional, data (próximos 14 dias) e horário livre |
| RF06 | Remarcar ou cancelar a reserva, e adicioná-la ao Google Agenda ou .ics |
| RF07 | Receber lembrete 1h antes, favoritar unidades, avaliar o atendimento e ver o histórico |

### Barbeiro

| ID | O sistema deve permitir ao barbeiro… |
|---|---|
| RF08 | Configurar a jornada: dias, início, fim e duração do intervalo (30 a 120 min) |
| RF09 | Gerar os horários do dia automaticamente a partir da jornada |
| RF10 | Bloquear e liberar horários livres da própria agenda |
| RF11 | Ver os atendimentos com o nome do cliente e encerrar como Finalizado ou Não compareceu |
| RF12 | Acompanhar o painel: atendimentos do dia e da semana, faturado no mês, nota média |
| RF13 | Cadastrar e editar serviços com nome, preço e duração |
| RF14 | Editar a unidade: descrição, contato, horário de atendimento e foto de capa |

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
| RN-O4 | Custo | Sem taxa para a barbearia: pagamento no local e infraestrutura nos planos gratuitos |

### Regras de negócio

| ID | Regra |
|---|---|
| RN01 | Só se reserva horário Livre e futuro, e o serviço precisa caber no intervalo |
| RN02 | Cada cliente tem no máximo 3 reservas futuras e nenhuma no mesmo horário |
| RN03 | Cancelar ou remarcar só até 2h antes; o horário antigo volta a Livre |
| RN04 | Só o barbeiro atribuído encerra, e só depois do início do atendimento |
| RN05 | Só o titular avalia (nota de 1 a 5), e só atendimentos Finalizados |
| RN06 | Jornada padrão: Seg a Sáb, 10:00 às 17:30, intervalos de 90 min; raio padrão de 5 km |
| RN07 | Pagamento feito no estabelecimento, em dinheiro, Pix ou cartão |

## 4. Requisitos de sistema

### Arquitetura

- **Interface:** React 18, TypeScript, Vite e Tailwind. Telas → estado → regras → repositório.
- **Backend:** Supabase — PostgreSQL com RLS, Auth por e-mail, Realtime e Storage de fotos. Região São Paulo.
- **Entrega:** site em produção na Vercel; app Android e iOS pelo Capacitor, com GPS e notificações nativas.
- Mapa com Leaflet + OpenStreetMap · 8 tabelas no banco · 11 funções SQL de regra · CI com GitHub Actions + Vitest.

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

## 5. Requisitos de usuário

| Como cliente, quero… | Como barbeiro, quero… |
|---|---|
| **RU01** achar uma barbearia perto de mim | **RU06** definir meus dias e horários de trabalho |
| **RU02** ver preço e duração antes de marcar | **RU07** ver quem vem hoje, com o nome do cliente |
| **RU03** agendar sem ligar e ser lembrado antes | **RU08** bloquear um horário quando não puder atender |
| **RU04** remarcar se surgir um imprevisto | **RU09** registrar quem faltou |
| **RU05** avaliar e ver a nota dos outros | **RU10** saber quanto faturei no mês |

## 6. Rastreabilidade

Negócio e usuário originam os funcionais e não funcionais; o sistema detalha a implementação.

| Negócio | Usuário | Funcional | Não funcional | Sistema |
|---|---|---|---|---|
| RN-O1 Agilidade | RU01, RU02, RU03 | RF02 a RF05 | RNF03, RNF04 | RS01, RS05 |
| RN-O2 Menos faltas | RU03, RU04, RU09 | RF06, RF07, RF11 | RNF05 | RS03, RS06 |
| RN-O3 Ocupação | RU05 a RU08 | RF07 a RF10 | RNF02 | RS03, RS07 |
| RN-O4 Custo | RU10 | RF12 a RF14 | RNF07 | RS02, RS04 |

## 7. Onde cada regra está no código

| Regra | Cliente (`src/domain/rules.ts`) | Servidor (SQL) |
|---|---|---|
| RN01, RN02 | confirmar | `confirmar_agendamento` + índice `agendamento_ativo_por_horario` |
| RN03 | cancelar, remarcar | `cancelar_agendamento`, `remarcar_agendamento` |
| RN04 | encerrar | `encerrar_atendimento` |
| RN05 | avaliar | `avaliar_atendimento` |
| RN06 | jornada padrão, raio padrão | `jornada_padrao`, `preparar_horarios` |
| RNF01 | — | RLS nas 8 tabelas |
| RNF08 | `rules.test.ts` | CI no GitHub Actions |
