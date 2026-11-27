-- BarberHUB: modelo de receita (27/11/2026).
-- 1) Assinatura mensal paga pela barbearia, com 30 dias de teste grátis.
-- 2) Parceria: a barbearia oferece preço diferenciado pelo app e ganha destaque (seção própria e selo "Parceira").
-- Sem gateway de pagamento: a cobrança é feita fora do app (Pix/boleto) e a equipe confirma
-- o pagamento e aprova parcerias pelas funções de administração no fim deste arquivo (SQL Editor do Supabase).
-- Espelha src/domain/rules.ts: valores e prazos daqui precisam ficar iguais aos de lá.

-- ───────────── Planos ─────────────
create table public.planos (
  id text primary key,
  nome text not null,
  preco_mensal numeric(10,2) not null check (preco_mensal >= 0),
  -- 0 = sem limite de profissionais.
  max_profissionais int not null default 0 check (max_profissionais >= 0),
  descricao text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true
);
alter table public.planos enable row level security;
create policy "planos públicos" on public.planos for select using (ativo);

insert into public.planos (id, nome, preco_mensal, max_profissionais, descricao, ordem) values
  ('basico', 'Básico', 49.90, 2, 'Para quem está começando: agenda online para até 2 barbeiros.', 1),
  ('profissional', 'Profissional', 89.90, 5, 'Para barbearias em crescimento: até 5 barbeiros.', 2),
  ('premium', 'Premium', 149.90, 0, 'Barbeiros ilimitados, para redes e unidades grandes.', 3);

-- ───────────── Assinaturas ─────────────
-- Uma por barbearia. Status gravado: Teste, Ativa, Pendente (plano escolhido, aguardando pagamento)
-- e Cancelada (não renova; vale até valida_ate). "Vencida" é calculada: valida_ate já passou.
create table public.assinaturas (
  barbearia_id text primary key references public.barbearias(id) on delete cascade,
  plano_id text not null references public.planos(id),
  status text not null check (status in ('Teste', 'Ativa', 'Pendente', 'Cancelada')),
  inicio timestamptz not null default now(),
  valida_ate timestamptz not null,
  atualizado_em timestamptz not null default now()
);
alter table public.assinaturas enable row level security;

-- Prazo público de visibilidade (RN08): o catálogo e o mapa só mostram barbearias com
-- visivel_ate no futuro. Mantido pelo trigger abaixo, para não expor a tabela de assinaturas.
alter table public.barbearias add column visivel_ate timestamptz;

create or replace function public.minha_barbearia_id() returns text
language sql stable security definer set search_path = public as $$
  select barbearia_id from public.profiles where id = auth.uid() and papel = 'Barbeiro'
$$;
revoke all on function public.minha_barbearia_id() from public, anon;
grant execute on function public.minha_barbearia_id() to authenticated;

create policy "assinatura da própria unidade" on public.assinaturas for select to authenticated
  using (barbearia_id = public.minha_barbearia_id());

create or replace function public.sincronizar_visibilidade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.barbearias set visivel_ate = new.valida_ate where id = new.barbearia_id;
  return new;
end $$;
revoke all on function public.sincronizar_visibilidade() from public, anon, authenticated;
create trigger assinaturas_visibilidade after insert or update of valida_ate on public.assinaturas
  for each row execute function public.sincronizar_visibilidade();

-- Barbearia nova começa com 30 dias de teste no plano Básico.
create or replace function public.iniciar_teste() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.assinaturas (barbearia_id, plano_id, status, valida_ate)
  values (new.id, 'basico', 'Teste', now() + interval '30 days')
  on conflict (barbearia_id) do nothing;
  return new;
end $$;
revoke all on function public.iniciar_teste() from public, anon, authenticated;
create trigger barbearias_teste after insert on public.barbearias
  for each row execute function public.iniciar_teste();

-- Unidades existentes: a Procópio (unidade de teste do barbeiro, 4 barbeiros) em teste no Profissional;
-- as demais com plano Profissional ativo por 1 ano, para a demonstração.
insert into public.assinaturas (barbearia_id, plano_id, status, valida_ate)
  select id,
         'profissional',
         case when id = 'bb001' then 'Teste' else 'Ativa' end,
         case when id = 'bb001' then now() + interval '30 days' else now() + interval '1 year' end
    from public.barbearias
  on conflict (barbearia_id) do nothing;

-- ───────────── Parcerias (barbearias em destaque) ─────────────
-- A busca é por localização, então a ordem continua sendo a distância. A parceira ganha destaque
-- por outro caminho: seção "Parceiras BarberHUB" no Início, selo "Parceira" e preço diferenciado
-- (desconto em todos os serviços agendados pelo app) enquanto a parceria estiver em vigor (RN09).
-- Solicitada → (equipe aprova) Ativa de inicio a fim, ou Recusada. O barbeiro pode cancelar o pedido
-- ou encerrar a parceria antes do fim; ao encerrar, sai do destaque e o desconto acaba.
create table public.parcerias (
  id uuid primary key default gen_random_uuid(),
  barbearia_id text not null references public.barbearias(id) on delete cascade,
  desconto_pct smallint not null check (desconto_pct in (10, 15, 20, 25, 30)),
  dias int not null check (dias in (30, 90)),
  status text not null check (status in ('Solicitada', 'Ativa', 'Recusada', 'Cancelada', 'Encerrada')),
  inicio timestamptz,
  fim timestamptz,
  criado_em timestamptz not null default now(),
  check (status <> 'Ativa' or (inicio is not null and fim is not null and fim > inicio))
);
create index parcerias_barbearia on public.parcerias (barbearia_id);
create unique index parceria_aberta_por_barbearia on public.parcerias (barbearia_id) where status in ('Solicitada', 'Ativa');
alter table public.parcerias enable row level security;
-- Todo mundo vê as parcerias em vigor (seção de destaque, selo e preço).
create policy "parcerias em vigor" on public.parcerias for select
  using (status = 'Ativa' and inicio <= now() and fim > now());
-- O barbeiro vê os pedidos e o histórico da própria unidade.
create policy "parcerias da própria unidade" on public.parcerias for select to authenticated
  using (barbearia_id = public.minha_barbearia_id());

-- Parcerias de demonstração: Barões (20%) e Procópio (15%, a unidade com serviços e agenda) por 90 dias.
insert into public.parcerias (barbearia_id, desconto_pct, dias, status, inicio, fim)
  values ('bb003', 20, 90, 'Ativa', now(), now() + interval '90 days'),
         ('bb001', 15, 90, 'Ativa', now(), now() + interval '90 days');

-- ───────────── RN08 e preço de parceira na reserva ─────────────
-- Reserva só em barbearia com assinatura em dia. Em parceira, o preço reservado já vem com o desconto.
create or replace function public.regras_reserva_barbearia() returns trigger
language plpgsql security definer set search_path = public as $$
declare ate timestamptz; pct int;
begin
  if new.status <> 'Confirmado' then return new; end if;
  if tg_op = 'UPDATE' and new.horario_id = old.horario_id then return new; end if;
  select visivel_ate into ate from public.barbearias where id = new.barbearia_id;
  if ate is null or ate <= now() then
    raise exception 'Esta barbearia não está recebendo reservas no momento.';
  end if;
  if tg_op = 'INSERT' and new.preco_reservado is not null then
    select desconto_pct into pct from public.parcerias
     where barbearia_id = new.barbearia_id and status = 'Ativa' and inicio <= now() and fim > now();
    if pct is not null then new.preco_reservado := round(new.preco_reservado * (100 - pct) / 100.0, 2); end if;
  end if;
  return new;
end $$;
revoke all on function public.regras_reserva_barbearia() from public, anon, authenticated;
create trigger agendamentos_regras_barbearia before insert or update of horario_id on public.agendamentos
  for each row execute function public.regras_reserva_barbearia();

-- ───────────── Funções do barbeiro ─────────────
-- RF15/RF16: escolher ou trocar de plano, renovar. Durante o teste só troca o plano;
-- fora dele fica Pendente até a equipe confirmar o pagamento.
create or replace function public.escolher_plano(p_plano text) returns public.assinaturas
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); pl public.planos; a public.assinaturas; equipe int;
begin
  select * into pl from public.planos where id = p_plano and ativo;
  if pl.id is null then raise exception 'Plano não encontrado.'; end if;
  select count(*) into equipe from public.profissionais where barbearia_id = me.barbearia_id;
  if pl.max_profissionais > 0 and equipe > pl.max_profissionais then
    raise exception 'Sua equipe tem % barbeiros; o plano % permite até %.', equipe, pl.nome, pl.max_profissionais;
  end if;
  select * into a from public.assinaturas where barbearia_id = me.barbearia_id for update;
  if a.barbearia_id is null then
    insert into public.assinaturas (barbearia_id, plano_id, status, valida_ate)
    values (me.barbearia_id, pl.id, 'Teste', now() + interval '30 days') returning * into a;
    return a;
  end if;
  update public.assinaturas
     set plano_id = pl.id,
         status = case when status = 'Teste' and valida_ate > now() then 'Teste' else 'Pendente' end,
         atualizado_em = now()
   where barbearia_id = a.barbearia_id
  returning * into a;
  return a;
end $$;

-- RF16: cancelar. A barbearia continua visível até o fim do período já pago (ou do teste).
create or replace function public.cancelar_assinatura() returns public.assinaturas
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); a public.assinaturas;
begin
  update public.assinaturas set status = 'Cancelada', atualizado_em = now()
   where barbearia_id = me.barbearia_id and status <> 'Cancelada'
  returning * into a;
  if a.barbearia_id is null then raise exception 'Não há assinatura para cancelar.'; end if;
  return a;
end $$;

-- RF17: aderir à parceria com um desconto e um período. Exige assinatura em dia.
create or replace function public.solicitar_parceria(p_desconto int, p_dias int) returns public.parcerias
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); a public.assinaturas; p public.parcerias;
begin
  if p_desconto not in (10, 15, 20, 25, 30) then raise exception 'Escolha um desconto entre 10%% e 30%%.'; end if;
  if p_dias not in (30, 90) then raise exception 'Escolha 30 ou 90 dias.'; end if;
  select * into a from public.assinaturas where barbearia_id = me.barbearia_id for update;
  if a.barbearia_id is null or a.valida_ate <= now() then
    raise exception 'Renove a assinatura para virar parceira.';
  end if;
  -- Ativa que já venceu não conta como aberta.
  update public.parcerias set status = 'Encerrada'
   where barbearia_id = me.barbearia_id and status = 'Ativa' and fim <= now();
  if exists (select 1 from public.parcerias where barbearia_id = me.barbearia_id and status in ('Solicitada', 'Ativa')) then
    raise exception 'Sua barbearia já tem uma parceria ativa ou em análise.';
  end if;
  insert into public.parcerias (barbearia_id, desconto_pct, dias, status)
  values (me.barbearia_id, p_desconto, p_dias, 'Solicitada') returning * into p;
  return p;
end $$;

-- Cancela o pedido em análise ou encerra a parceria ativa antes do fim.
create or replace function public.encerrar_parceria(p_id uuid) returns public.parcerias
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); p public.parcerias;
begin
  update public.parcerias
     set status = case when status = 'Solicitada' then 'Cancelada' else 'Encerrada' end,
         fim = case when status = 'Ativa' then least(fim, now()) else fim end
   where id = p_id and barbearia_id = me.barbearia_id and status in ('Solicitada', 'Ativa')
  returning * into p;
  if p.id is null then raise exception 'Parceria não encontrada.'; end if;
  return p;
end $$;

revoke all on function public.escolher_plano(text), public.cancelar_assinatura(), public.solicitar_parceria(int, int),
  public.encerrar_parceria(uuid) from public, anon;
grant execute on function public.escolher_plano(text), public.cancelar_assinatura(), public.solicitar_parceria(int, int),
  public.encerrar_parceria(uuid) to authenticated;

-- ───────────── Administração (só pelo SQL Editor / service role) ─────────────
-- Confirma o pagamento de N meses: assinatura Ativa, prazo somado ao que ainda restava.
create or replace function public.admin_confirmar_pagamento(p_barbearia text, p_meses int default 1) returns public.assinaturas
language plpgsql security definer set search_path = public as $$
declare a public.assinaturas;
begin
  if p_meses not between 1 and 12 then raise exception 'Informe de 1 a 12 meses.'; end if;
  update public.assinaturas
     set status = 'Ativa',
         valida_ate = greatest(valida_ate, now()) + make_interval(months => p_meses),
         atualizado_em = now()
   where barbearia_id = p_barbearia
  returning * into a;
  if a.barbearia_id is null then raise exception 'Barbearia sem assinatura.'; end if;
  return a;
end $$;

-- Aprova o pedido de parceria: começa agora e dura os dias escolhidos.
create or replace function public.admin_aprovar_parceria(p_id uuid) returns public.parcerias
language plpgsql security definer set search_path = public as $$
declare p public.parcerias;
begin
  update public.parcerias set status = 'Ativa', inicio = now(), fim = now() + make_interval(days => dias)
   where id = p_id and status = 'Solicitada'
  returning * into p;
  if p.id is null then raise exception 'Pedido não encontrado ou já analisado.'; end if;
  return p;
end $$;

create or replace function public.admin_recusar_parceria(p_id uuid) returns public.parcerias
language plpgsql security definer set search_path = public as $$
declare p public.parcerias;
begin
  update public.parcerias set status = 'Recusada' where id = p_id and status = 'Solicitada' returning * into p;
  if p.id is null then raise exception 'Pedido não encontrado ou já analisado.'; end if;
  return p;
end $$;

revoke all on function public.admin_confirmar_pagamento(text, int), public.admin_aprovar_parceria(uuid),
  public.admin_recusar_parceria(uuid) from public, anon, authenticated;

alter publication supabase_realtime add table public.assinaturas, public.parcerias;
