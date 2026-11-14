-- BarberHUB: schema, segurança (RLS) e regras de negócio atômicas.
-- Espelha src/domain/types.ts e src/domain/rules.ts (doc técnica v1.4, UML 06/10/2026).

create extension if not exists pgcrypto;

-- ───────────── Catálogo ─────────────
create table public.barbearias (
  id text primary key,
  nome text not null,
  endereco text not null,
  cidade text not null default 'Manaus',
  bairro text not null,
  descricao text not null default '',
  lat double precision not null,
  lng double precision not null,
  foto_capa text,
  marca jsonb not null default '{}'::jsonb
);

create table public.profissionais (
  id text primary key,
  nome text not null,
  descricao text not null default '',
  especialidades text not null default '',
  barbearia_id text not null references public.barbearias(id),
  email_acesso text unique,
  foto text
);

create table public.servicos (
  id text primary key,
  barbearia_id text not null references public.barbearias(id),
  nome text not null,
  descricao text not null default '',
  preco numeric(10,2) not null check (preco >= 0),
  duracao_minutos integer not null check (duracao_minutos > 0),
  categoria text not null default '',
  inclui text not null default '',
  disponivel boolean not null default true,
  icone text not null default 'corte' check (icone in ('corte','barba','combo','pezinho'))
);

-- ───────────── Perfis ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null default '',
  foto text,
  papel text not null default 'Cliente' check (papel in ('Cliente','Barbeiro')),
  profissional_id text references public.profissionais(id),
  barbearia_id text references public.barbearias(id),
  localizacao jsonb,
  raio_busca_km integer check (raio_busca_km in (0,1,3,5,10,20)),
  favoritos text[] not null default '{}',
  data_busca jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- Cria o perfil no primeiro login. Se o e-mail for o de acesso de um profissional,
-- o perfil já nasce como Barbeiro vinculado (substitui o vínculo manual do Glide).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profissionais;
begin
  select * into p from public.profissionais where lower(email_acesso) = lower(new.email);
  insert into public.profiles (id, email, nome, papel, profissional_id, barbearia_id)
  values (
    new.id, new.email,
    coalesce(p.nome, split_part(new.email, '@', 1)),
    case when p.id is null then 'Cliente' else 'Barbeiro' end,
    p.id, p.barbearia_id
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- O usuário edita nome, foto e preferências; nunca papel, vínculos ou e-mail.
create or replace function public.proteger_perfil() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;
    new.papel := old.papel;
    new.profissional_id := old.profissional_id;
    new.barbearia_id := old.barbearia_id;
  end if;
  return new;
end $$;

create trigger profiles_proteger before update on public.profiles
  for each row execute function public.proteger_perfil();

-- ───────────── Agenda ─────────────
create table public.horarios (
  id text primary key,
  profissional_id text not null references public.profissionais(id),
  barbearia_id text not null references public.barbearias(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'Livre' check (status in ('Livre','Ocupado','Bloqueado')),
  check (fim > inicio)
);
create index horarios_prof_inicio on public.horarios (profissional_id, inicio);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  protocolo uuid not null default gen_random_uuid(),
  barbearia_id text not null references public.barbearias(id),
  servico_id text not null references public.servicos(id),
  profissional_id text not null references public.profissionais(id),
  horario_id text not null references public.horarios(id),
  cliente_id uuid not null references public.profiles(id),
  cliente_email text not null,
  barbeiro_email text,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null check (status in ('Confirmado','Indisponível','Cancelado','Finalizado')),
  preco_reservado numeric(10,2),
  duracao_reservada integer,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agendamentos_cliente on public.agendamentos (cliente_id);
create index agendamentos_prof on public.agendamentos (profissional_id);
-- Garantia física que o Glide não tinha: no máximo uma reserva ativa por horário.
create unique index agendamento_ativo_por_horario on public.agendamentos (horario_id) where status = 'Confirmado';

-- ───────────── RLS ─────────────
alter table public.barbearias enable row level security;
alter table public.profissionais enable row level security;
alter table public.servicos enable row level security;
alter table public.profiles enable row level security;
alter table public.horarios enable row level security;
alter table public.agendamentos enable row level security;

create policy "catálogo público" on public.barbearias for select using (true);
create policy "catálogo público" on public.profissionais for select using (true);
create policy "catálogo público" on public.servicos for select using (true);
create policy "horários visíveis" on public.horarios for select using (true);

create policy "ler o próprio perfil" on public.profiles for select using (id = auth.uid());
create policy "editar o próprio perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.meu_profissional_id() returns text
language sql stable security definer set search_path = public as $$
  select profissional_id from public.profiles where id = auth.uid() and papel = 'Barbeiro'
$$;

-- Row Owners do Glide: cliente titular OU profissional atribuído.
create policy "reservas do cliente ou do barbeiro" on public.agendamentos for select
  using (cliente_id = auth.uid() or profissional_id = public.meu_profissional_id());

-- Escritas em horários, reservas e capa só pelas funções abaixo (sem policies de insert/update).

-- ───────────── Regras de negócio (transacionais) ─────────────

-- 5.7 Preparar horários: cria 10h e 14h (90 min, horário de Manaus) que faltam e ainda são futuros.
create or replace function public.preparar_horarios(p_profissional text, p_dia date) returns void
language plpgsql security definer set search_path = public as $$
declare prof public.profissionais; h int; ini timestamptz;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  select * into prof from public.profissionais where id = p_profissional;
  if prof.id is null then raise exception 'Profissional não encontrado.'; end if;
  if p_dia < (now() at time zone 'America/Manaus')::date then raise exception 'Escolha hoje ou uma data futura.'; end if;
  foreach h in array array[10, 14] loop
    ini := (p_dia + make_time(h, 0, 0)) at time zone 'America/Manaus';
    if ini > now() then
      insert into public.horarios (id, profissional_id, barbearia_id, inicio, fim, status)
      values (p_profissional || '-' || to_char(p_dia, 'YYYY-MM-DD') || '-' || lpad(h::text, 2, '0') || '00',
              p_profissional, prof.barbearia_id, ini, ini + interval '90 minutes', 'Livre')
      on conflict (id) do nothing;
    end if;
  end loop;
end $$;

-- 5.1 Confirmar: trava o horário, verifica Livre + futuro, ocupa e cria a reserva no mesmo commit.
create or replace function public.confirmar_agendamento(p_horario text, p_servico text) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare h public.horarios; s public.servicos; pr public.profissionais; me public.profiles; r public.agendamentos;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Entre na sua conta para continuar.'; end if;
  select * into h from public.horarios where id = p_horario for update;
  if h.id is null then raise exception 'Horário não encontrado.'; end if;
  select * into s from public.servicos where id = p_servico and barbearia_id = h.barbearia_id and disponivel;
  if s.id is null then raise exception 'Escolha um serviço.'; end if;
  select * into pr from public.profissionais where id = h.profissional_id;

  if h.status <> 'Livre' or h.inicio <= now() then
    insert into public.agendamentos (barbearia_id, servico_id, profissional_id, horario_id, cliente_id, cliente_email, barbeiro_email, inicio, fim, status)
    values (h.barbearia_id, s.id, h.profissional_id, h.id, me.id, me.email, pr.email_acesso, h.inicio, h.fim, 'Indisponível')
    returning * into r;
    return r;
  end if;

  update public.horarios set status = 'Ocupado' where id = h.id;
  insert into public.agendamentos (barbearia_id, servico_id, profissional_id, horario_id, cliente_id, cliente_email, barbeiro_email, inicio, fim, status, preco_reservado, duracao_reservada)
  values (h.barbearia_id, s.id, h.profissional_id, h.id, me.id, me.email, pr.email_acesso, h.inicio, h.fim, 'Confirmado', s.preco, s.duracao_minutos)
  returning * into r;
  return r;
end $$;

-- 5.2 Cancelar: só o titular, só Confirmado; devolve o horário a Livre.
create or replace function public.cancelar_agendamento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos;
begin
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.cliente_id <> auth.uid() then raise exception 'Apenas o cliente titular pode cancelar.'; end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser canceladas.'; end if;
  update public.agendamentos set status = 'Cancelado', atualizado_em = now() where id = a.id;
  update public.horarios set status = 'Livre' where id = a.horario_id and status = 'Ocupado';
end $$;

-- 5.3 Finalizar: só o profissional atribuído; o horário continua Ocupado.
create or replace function public.finalizar_atendimento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos;
begin
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.profissional_id is distinct from public.meu_profissional_id() then raise exception 'Apenas o profissional atribuído pode finalizar.'; end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser finalizadas.'; end if;
  update public.agendamentos set status = 'Finalizado', atualizado_em = now() where id = a.id;
end $$;

-- 5.4 Bloquear/liberar: só o profissional do horário; nunca mexe em Ocupado.
create or replace function public.alternar_bloqueio(p_horario text) returns void
language plpgsql security definer set search_path = public as $$
declare h public.horarios;
begin
  select * into h from public.horarios where id = p_horario for update;
  if h.id is null then raise exception 'Horário não encontrado.'; end if;
  if h.profissional_id is distinct from public.meu_profissional_id() then raise exception 'Apenas o profissional do horário pode alterar.'; end if;
  if h.status = 'Ocupado' then raise exception 'Horário ocupado por uma reserva.'; end if;
  update public.horarios set status = case when h.status = 'Livre' then 'Bloqueado' else 'Livre' end where id = h.id;
end $$;

-- 4.1 Foto da barbearia: só o barbeiro vinculado à unidade.
create or replace function public.atualizar_foto_barbearia(p_barbearia text, p_foto text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.papel is distinct from 'Barbeiro' or me.barbearia_id is distinct from p_barbearia then
    raise exception 'Apenas o barbeiro vinculado pode alterar a foto.';
  end if;
  if p_foto is not null and length(p_foto) > 1500000 then raise exception 'Imagem muito grande.'; end if;
  update public.barbearias set foto_capa = p_foto where id = p_barbearia;
end $$;

revoke all on function public.preparar_horarios, public.confirmar_agendamento, public.cancelar_agendamento,
  public.finalizar_atendimento, public.alternar_bloqueio, public.atualizar_foto_barbearia from public, anon;
grant execute on function public.preparar_horarios, public.confirmar_agendamento, public.cancelar_agendamento,
  public.finalizar_atendimento, public.alternar_bloqueio, public.atualizar_foto_barbearia to authenticated;

-- Realtime: telas atualizam quando horários e reservas mudam.
alter publication supabase_realtime add table public.horarios, public.agendamentos, public.barbearias;
