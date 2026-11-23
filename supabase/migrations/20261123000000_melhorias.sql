-- BarberHUB: melhorias de 23/11/2026.
-- Agenda configurável, remarcar, avaliações, contato da unidade, serviços editáveis,
-- prazos e limites de reserva, e-mail de acesso fora da API pública, fotos no Storage.
-- Espelha src/domain/rules.ts: os limites daqui precisam ficar iguais aos de lá.

-- ───────────── E-mail de acesso dos barbeiros fora do catálogo público ─────────────
-- Antes ficava em profissionais.email_acesso, que qualquer pessoa podia ler pela API.
create table public.acessos_profissionais (
  email text primary key check (email = lower(email)),
  profissional_id text not null unique references public.profissionais(id) on delete cascade
);
alter table public.acessos_profissionais enable row level security;
-- Sem policies: só funções security definer (e o painel do Supabase) leem esta tabela.
insert into public.acessos_profissionais (email, profissional_id)
  select lower(email_acesso), id from public.profissionais where email_acesso is not null
  on conflict do nothing;
alter table public.profissionais drop column email_acesso;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profissionais;
begin
  select pr.* into p from public.acessos_profissionais a join public.profissionais pr on pr.id = a.profissional_id
   where a.email = lower(new.email);
  insert into public.profiles (id, email, nome, papel, profissional_id, barbearia_id)
  values (
    new.id, new.email,
    coalesce(p.nome, split_part(new.email, '@', 1)),
    case when p.id is null then 'Cliente' else 'Barbeiro' end,
    p.id, p.barbearia_id
  );
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- ───────────── Colunas novas ─────────────
alter table public.profissionais add column jornada jsonb;
alter table public.barbearias add column telefone text, add column whatsapp text;

alter table public.agendamentos add column cliente_nome text;
update public.agendamentos a set cliente_nome = p.nome from public.profiles p where p.id = a.cliente_id;
-- O barbeiro não precisa do próprio e-mail na reserva, e o cliente não deve vê-lo.
alter table public.agendamentos drop column barbeiro_email;
-- Tentativas recusadas não são mais gravadas.
delete from public.agendamentos where status = 'Indisponível';
alter table public.agendamentos drop constraint agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('Confirmado','Indisponível','Cancelado','Finalizado','Não compareceu'));
create index agendamentos_horario on public.agendamentos (horario_id);

-- Fotos passam a ser endereços do Storage (bucket "fotos"), não a imagem inteira em texto.
alter table public.profiles add constraint profiles_foto_url check (foto is null or length(foto) <= 2000) not valid;

-- ───────────── Avaliações ─────────────
create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null unique references public.agendamentos(id) on delete cascade,
  barbearia_id text not null references public.barbearias(id),
  profissional_id text not null references public.profissionais(id),
  cliente_nome text not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text not null default '' check (length(comentario) <= 500),
  criado_em timestamptz not null default now()
);
create index avaliacoes_barbearia on public.avaliacoes (barbearia_id);
alter table public.avaliacoes enable row level security;
create policy "avaliações públicas" on public.avaliacoes for select using (true);

-- ───────────── Funções auxiliares ─────────────
create or replace function public.jornada_padrao() returns jsonb
language sql immutable set search_path = public as $$
  select '{"dias":[1,2,3,4,5,6],"inicio":"10:00","fim":"17:30","intervaloMin":90}'::jsonb
$$;

create or replace function public.minutos_do_dia(p text) returns int
language sql immutable set search_path = public as $$
  select split_part(p, ':', 1)::int * 60 + split_part(p, ':', 2)::int
$$;

-- Telefone só com dígitos e DDD (10 ou 11). Vazio vira null.
create or replace function public.normalizar_telefone(p text) returns text
language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d ~ '^55\d{10,11}$' then d := substr(d, 3); end if;
  if d = '' then return null; end if;
  if length(d) not between 10 and 11 then raise exception 'Telefone com DDD, ex.: (92) 99999-9999.'; end if;
  return d;
end $$;

create or replace function public.meu_perfil_barbeiro() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.papel is distinct from 'Barbeiro' or me.profissional_id is null or me.barbearia_id is null then
    raise exception 'Apenas barbeiros com vínculo podem fazer isso.';
  end if;
  return me;
end $$;

-- ───────────── Agenda configurável ─────────────
-- 5.7 Preparar horários a partir da jornada (horário de Manaus). Cria os que faltam e tira
-- os livres que saíram da jornada; se um deles já teve reserva (cancelada), fica bloqueado.
create or replace function public.preparar_horarios(p_profissional text, p_dia date) returns void
language plpgsql security definer set search_path = public as $$
declare prof public.profissionais; j jsonb; t int; ate int; passo int; ini timestamptz; hid text; ids text[] := '{}';
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para continuar.'; end if;
  select * into prof from public.profissionais where id = p_profissional;
  if prof.id is null then raise exception 'Profissional não encontrado.'; end if;
  if p_dia < (now() at time zone 'America/Manaus')::date then raise exception 'Escolha hoje ou uma data futura.'; end if;
  j := coalesce(prof.jornada, public.jornada_padrao());
  if (j->'dias') @> to_jsonb(extract(dow from p_dia)::int) then
    t := public.minutos_do_dia(j->>'inicio');
    ate := public.minutos_do_dia(j->>'fim');
    passo := (j->>'intervaloMin')::int;
    while t + passo <= ate loop
      ini := (p_dia + make_interval(mins => t)) at time zone 'America/Manaus';
      hid := p_profissional || '-' || to_char(p_dia, 'YYYY-MM-DD') || '-' || lpad((t / 60)::text, 2, '0') || lpad((t % 60)::text, 2, '0');
      ids := ids || hid;
      if ini > now() then
        insert into public.horarios (id, profissional_id, barbearia_id, inicio, fim, status)
        values (hid, p_profissional, prof.barbearia_id, ini, ini + make_interval(mins => passo), 'Livre')
        on conflict (id) do nothing;
      end if;
      t := t + passo;
    end loop;
  end if;
  -- Livres que saíram da jornada.
  update public.horarios h set status = 'Bloqueado'
   where h.profissional_id = p_profissional and h.status = 'Livre' and h.inicio > now()
     and (h.inicio at time zone 'America/Manaus')::date = p_dia and not (h.id = any(ids))
     and exists (select 1 from public.agendamentos a where a.horario_id = h.id);
  delete from public.horarios h
   where h.profissional_id = p_profissional and h.status = 'Livre' and h.inicio > now()
     and (h.inicio at time zone 'America/Manaus')::date = p_dia and not (h.id = any(ids));
end $$;

create or replace function public.salvar_jornada(p_jornada jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); dias jsonb; ini text; fim text; passo int;
begin
  select coalesce(jsonb_agg(distinct d::int order by d::int), '[]'::jsonb) into dias
    from jsonb_array_elements_text(coalesce(p_jornada->'dias', '[]'::jsonb)) d where d ~ '^[0-6]$';
  ini := p_jornada->>'inicio';
  fim := p_jornada->>'fim';
  passo := (p_jornada->>'intervaloMin')::int;
  if jsonb_array_length(dias) = 0 then raise exception 'Escolha pelo menos um dia de atendimento.'; end if;
  if ini !~ '^([01]\d|2[0-3]):[0-5]\d$' or fim !~ '^([01]\d|2[0-3]):[0-5]\d$' then raise exception 'Horário inválido.'; end if;
  if passo not in (30, 45, 60, 90, 120) then raise exception 'Duração do intervalo inválida.'; end if;
  if public.minutos_do_dia(fim) - public.minutos_do_dia(ini) < passo then
    raise exception 'O expediente precisa caber pelo menos um intervalo.';
  end if;
  update public.profissionais
     set jornada = jsonb_build_object('dias', dias, 'inicio', ini, 'fim', fim, 'intervaloMin', passo)
   where id = me.profissional_id;
end $$;

-- ───────────── Reservas ─────────────
-- 5.1 Confirmar: limite de 3 reservas futuras, sem choque de horário, serviço cabe no intervalo.
-- Tentativa recusada vira erro (não grava mais "Indisponível").
drop function public.confirmar_agendamento(text, text);
create function public.confirmar_agendamento(p_horario text, p_servico text) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare h public.horarios; s public.servicos; me public.profiles; r public.agendamentos;
begin
  -- Trava o perfil: duas confirmações simultâneas da mesma pessoa não furam o limite.
  select * into me from public.profiles where id = auth.uid() for update;
  if me.id is null then raise exception 'Entre na sua conta para continuar.'; end if;
  if (select count(*) from public.agendamentos where cliente_id = me.id and status = 'Confirmado' and inicio > now()) >= 3 then
    raise exception 'Você já tem 3 reservas futuras. Conclua ou cancele uma para agendar outra.';
  end if;
  select * into h from public.horarios where id = p_horario for update;
  if h.id is null then raise exception 'Horário não encontrado.'; end if;
  if h.status <> 'Livre' or h.inicio <= now() then raise exception 'Esse horário acabou de ficar indisponível. Escolha outro.'; end if;
  select * into s from public.servicos where id = p_servico and barbearia_id = h.barbearia_id and disponivel;
  if s.id is null then raise exception 'Escolha um serviço.'; end if;
  if s.duracao_minutos > extract(epoch from h.fim - h.inicio) / 60 then
    raise exception 'Esse serviço não cabe neste horário. Escolha outro serviço.';
  end if;
  if exists (select 1 from public.agendamentos where cliente_id = me.id and status = 'Confirmado' and inicio < h.fim and h.inicio < fim) then
    raise exception 'Você já tem uma reserva nesse mesmo horário.';
  end if;

  update public.horarios set status = 'Ocupado' where id = h.id;
  insert into public.agendamentos (barbearia_id, servico_id, profissional_id, horario_id, cliente_id, cliente_email, cliente_nome, inicio, fim, status, preco_reservado, duracao_reservada)
  values (h.barbearia_id, s.id, h.profissional_id, h.id, me.id, me.email, me.nome, h.inicio, h.fim, 'Confirmado', s.preco, s.duracao_minutos)
  returning * into r;
  return r;
end $$;

-- 5.2 Cancelar: só o titular, só Confirmado, até 2h antes. Devolve o horário a Livre.
create or replace function public.cancelar_agendamento(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos;
begin
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.cliente_id <> auth.uid() then raise exception 'Apenas o cliente titular pode cancelar.'; end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser canceladas.'; end if;
  if a.inicio - now() < interval '2 hours' then
    raise exception 'Só é possível cancelar até 2h antes do horário. Fale com a barbearia.';
  end if;
  update public.agendamentos set status = 'Cancelado', atualizado_em = now() where id = a.id;
  update public.horarios set status = 'Livre' where id = a.horario_id and status = 'Ocupado';
end $$;

-- Remarcar: troca o horário (mesma barbearia e serviço) no mesmo commit.
create or replace function public.remarcar_agendamento(p_id uuid, p_horario text) returns public.agendamentos
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos; h public.horarios; r public.agendamentos;
begin
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.cliente_id <> auth.uid() then raise exception 'Apenas o cliente titular pode remarcar.'; end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser remarcadas.'; end if;
  if a.inicio - now() < interval '2 hours' then
    raise exception 'Só é possível remarcar até 2h antes do horário. Fale com a barbearia.';
  end if;
  select * into h from public.horarios where id = p_horario for update;
  if h.id is null then raise exception 'Horário não encontrado.'; end if;
  if h.barbearia_id <> a.barbearia_id then raise exception 'Escolha um horário na mesma barbearia.'; end if;
  if h.status <> 'Livre' or h.inicio <= now() then raise exception 'Esse horário acabou de ficar indisponível. Escolha outro.'; end if;
  if coalesce(a.duracao_reservada, 0) > extract(epoch from h.fim - h.inicio) / 60 then
    raise exception 'Esse serviço não cabe neste horário. Escolha outro serviço.';
  end if;
  if exists (select 1 from public.agendamentos where id <> a.id and cliente_id = a.cliente_id and status = 'Confirmado' and inicio < h.fim and h.inicio < fim) then
    raise exception 'Você já tem uma reserva nesse mesmo horário.';
  end if;
  update public.horarios set status = 'Livre' where id = a.horario_id and status = 'Ocupado';
  update public.horarios set status = 'Ocupado' where id = h.id;
  update public.agendamentos
     set horario_id = h.id, profissional_id = h.profissional_id, inicio = h.inicio, fim = h.fim, atualizado_em = now()
   where id = a.id
  returning * into r;
  return r;
end $$;

-- 5.3 Encerrar: só o profissional atribuído e só depois do início. Finalizado ou Não compareceu.
drop function public.finalizar_atendimento(uuid);
create function public.encerrar_atendimento(p_id uuid, p_resultado text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos;
begin
  if p_resultado not in ('Finalizado', 'Não compareceu') then raise exception 'Resultado inválido.'; end if;
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if a.profissional_id is distinct from public.meu_profissional_id() then raise exception 'Apenas o profissional atribuído pode encerrar o atendimento.'; end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser encerradas.'; end if;
  if a.inicio > now() then raise exception 'O atendimento ainda não começou.'; end if;
  update public.agendamentos set status = p_resultado, atualizado_em = now() where id = a.id;
end $$;

-- ───────────── Avaliações ─────────────
create or replace function public.avaliar_atendimento(p_id uuid, p_nota int, p_comentario text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos; me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  select * into a from public.agendamentos where id = p_id;
  if a.id is null or a.cliente_id is distinct from me.id then raise exception 'Agendamento não encontrado.'; end if;
  if a.status <> 'Finalizado' then raise exception 'Só atendimentos finalizados podem ser avaliados.'; end if;
  if p_nota is null or p_nota not between 1 and 5 then raise exception 'Escolha de 1 a 5 estrelas.'; end if;
  insert into public.avaliacoes (agendamento_id, barbearia_id, profissional_id, cliente_nome, nota, comentario)
  values (a.id, a.barbearia_id, a.profissional_id, left(coalesce(nullif(split_part(me.nome, ' ', 1), ''), 'Cliente'), 40), p_nota, left(trim(coalesce(p_comentario, '')), 500))
  on conflict (agendamento_id) do nothing;
  if not found then raise exception 'Você já avaliou este atendimento.'; end if;
end $$;

-- ───────────── Área do barbeiro: unidade e serviços ─────────────
create or replace function public.atualizar_barbearia(p_descricao text, p_telefone text, p_whatsapp text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro();
begin
  update public.barbearias
     set descricao = left(trim(coalesce(p_descricao, '')), 400),
         telefone = public.normalizar_telefone(p_telefone),
         whatsapp = public.normalizar_telefone(p_whatsapp)
   where id = me.barbearia_id;
end $$;

create or replace function public.salvar_servico(p_servico jsonb) returns public.servicos
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); r public.servicos;
  v_nome text := trim(coalesce(p_servico->>'nome', ''));
  v_preco numeric := (p_servico->>'preco')::numeric;
  v_dur int := (p_servico->>'duracaoMinutos')::int;
  v_icone text := coalesce(p_servico->>'icone', 'corte');
begin
  if length(v_nome) not between 2 and 60 then raise exception 'Dê um nome ao serviço (2 a 60 letras).'; end if;
  if v_preco is null or v_preco < 0 or v_preco > 10000 then raise exception 'Preço inválido.'; end if;
  if v_dur is null or v_dur not between 5 and 240 then raise exception 'Duração entre 5 e 240 minutos.'; end if;
  if v_icone not in ('corte','barba','combo','pezinho') then v_icone := 'corte'; end if;
  if p_servico->>'id' is not null then
    update public.servicos
       set nome = v_nome, descricao = left(trim(coalesce(p_servico->>'descricao', '')), 200), preco = v_preco,
           duracao_minutos = v_dur, categoria = left(trim(coalesce(p_servico->>'categoria', '')), 40),
           inclui = left(trim(coalesce(p_servico->>'inclui', '')), 120),
           disponivel = coalesce((p_servico->>'disponivel')::boolean, true), icone = v_icone
     where id = p_servico->>'id' and barbearia_id = me.barbearia_id
    returning * into r;
    if r.id is null then raise exception 'Serviço não encontrado.'; end if;
  else
    insert into public.servicos (id, barbearia_id, nome, descricao, preco, duracao_minutos, categoria, inclui, disponivel, icone)
    values ('srv-' || left(replace(gen_random_uuid()::text, '-', ''), 8), me.barbearia_id, v_nome,
            left(trim(coalesce(p_servico->>'descricao', '')), 200), v_preco, v_dur,
            left(trim(coalesce(p_servico->>'categoria', '')), 40), left(trim(coalesce(p_servico->>'inclui', '')), 120),
            coalesce((p_servico->>'disponivel')::boolean, true), v_icone)
    returning * into r;
  end if;
  return r;
end $$;

-- 4.1 Foto da barbearia: agora um endereço https do Storage.
create or replace function public.atualizar_foto_barbearia(p_barbearia text, p_foto text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.papel is distinct from 'Barbeiro' or me.barbearia_id is distinct from p_barbearia then
    raise exception 'Apenas o barbeiro vinculado pode alterar a foto.';
  end if;
  if p_foto is not null and (p_foto !~ '^https://' or length(p_foto) > 2000) then raise exception 'Envie a foto de novo.'; end if;
  update public.barbearias set foto_capa = p_foto where id = p_barbearia;
end $$;

-- ───────────── Storage: bucket público de fotos ─────────────
-- perfis/<uid>/… para a foto de cada pessoa; barbearias/<id>/… só para o barbeiro vinculado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "enviar a própria foto" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos' and (
      ((storage.foldername(name))[1] = 'perfis' and (storage.foldername(name))[2] = auth.uid()::text)
      or ((storage.foldername(name))[1] = 'barbearias'
          and (storage.foldername(name))[2] = (select barbearia_id from public.profiles where id = auth.uid() and papel = 'Barbeiro'))
    )
  );

-- ───────────── Permissões e Realtime ─────────────
revoke all on function public.preparar_horarios, public.salvar_jornada, public.confirmar_agendamento, public.cancelar_agendamento,
  public.remarcar_agendamento, public.encerrar_atendimento, public.avaliar_atendimento, public.atualizar_barbearia,
  public.salvar_servico, public.atualizar_foto_barbearia, public.meu_perfil_barbeiro from public, anon;
grant execute on function public.preparar_horarios, public.salvar_jornada, public.confirmar_agendamento, public.cancelar_agendamento,
  public.remarcar_agendamento, public.encerrar_atendimento, public.avaliar_atendimento, public.atualizar_barbearia,
  public.salvar_servico, public.atualizar_foto_barbearia, public.meu_perfil_barbeiro to authenticated;

alter publication supabase_realtime add table public.profissionais, public.servicos, public.avaliacoes;
