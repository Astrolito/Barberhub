# Histórico

## Versões

| Data | Mudança |
|---|---|
| 13–14/11/2026 | Primeira versão em código (PR #1): catálogo, agendamento, Área do barbeiro, modo demonstração e Supabase. Publicada na Vercel. |
| 23/11/2026 | Mapa de barbearias próximas com filtro por raio (PR #2). |
| 23/11/2026 | Melhorias (PR #3): agenda configurável, remarcar, avaliações, acesso de barbeiro por lista de e-mails, fotos no Storage, testes e CI. |
| 23/11/2026 | Mapa: tiles do CARTO trocados pelos do OpenStreetMap (PR #4). |
| 27/11/2026 | Banco Supabase reativado depois da pausa do plano gratuito; documentação reorganizada em `docs/` com o documento de requisitos. |

## Melhorias em relação ao Glide

- Término real do serviço exibido (início + duração), separado do fim do intervalo de 90 min (pendência da v1.4).
- Horários do dia preparados automaticamente ao escolher a data, com seletor rápido de 14 dias.
- Confirmação verifica e ocupa o horário no mesmo passo (sem janela entre checar e gravar).
- Logout real e direto no Perfil e no menu lateral.
- Atalho para a Área do barbeiro no Perfil (pendência da v1.4).
- Confirmação antes de cancelar, término e valor na revisão, cartão de "próximo agendamento" no Início.
- Catálogo ordenado pela distância, com o km em cada capa, e mensagem vazia com atalho para "Sem limite".
- Mapa de barbearias próximas com o círculo do raio.
- Busca por endereço com geocodificação (OpenStreetMap) e alternativa por bairro de Manaus.
- Interações no estilo Emil Kowalski: feedback de pressão, bottom sheet arrastável, toasts, transições curtas com ease-out, respeito a `prefers-reduced-motion`.

## Melhorias de 23/11/2026

- **Regras:** prazo de 2h para cancelar/remarcar, limite de 3 reservas futuras, sem reservas sobrepostas, encerrar só depois do início, status `Não compareceu`, tentativas recusadas não viram registro.
- **Cliente:** remarcar (inclusive trocando de barbeiro), Google Agenda / `.ics`, lembrete no app instalado, avaliações com nota no catálogo, agendar a partir do serviço, WhatsApp/telefone e horário de atendimento na página da unidade.
- **Barbeiro:** agenda configurável, painel (dia, semana, faturado no mês, nota, pendentes), serviços editáveis, descrição e contato da unidade, nome do cliente nos atendimentos.
- **Segurança e desempenho:** e-mail de acesso fora da API pública, fotos no Storage, Realtime aplica só a linha alterada, tela de erro e aviso sem internet, testes automáticos e CI.
