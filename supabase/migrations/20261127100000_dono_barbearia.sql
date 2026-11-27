-- BarberHUB: dono da barbearia (27/11/2026).
-- 1) Cada conta de barbeiro só enxerga e gerencia a própria barbearia (e não reserva em outras).
-- 2) O dono (acessos_profissionais.dono) gerencia a unidade: equipe (adicionar, editar, remover
--    barbeiros e convidar pelo e-mail), agenda e horários de cada um, serviços, dados da unidade,
--    plano e parceria. O barbeiro comum cuida só da própria agenda e dos próprios atendimentos.
-- Espelha src/domain/rules.ts.

-- ───────────── Colunas ─────────────
alter table public.acessos_profissionais add column dono boolean not null default false;
alter table public.profiles add column dono boolean not null default false;
-- Barbeiro removido da equipe sai do catálogo, mas o histórico (reservas, avaliações) continua.
alter table public.profissionais add column ativo boolean not null default true;

-- O usuário não muda o próprio papel, vínculos nem a marca de dono.
create or replace function public.proteger_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated','anon') then
    new.email := old.email;
    new.papel := old.papel;
    new.profissional_id := old.profissional_id;
    new.barbearia_id := old.barbearia_id;
    new.dono := old.dono;
  end if;
  return new;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.acessos_profissionais; p public.profissionais;
begin
  select * into a from public.acessos_profissionais where email = lower(new.email);
  if a.email is not null then select * into p from public.profissionais where id = a.profissional_id and ativo; end if;
  insert into public.profiles (id, email, nome, papel, profissional_id, barbearia_id, dono)
  values (
    new.id, new.email,
    coalesce(p.nome, split_part(new.email, '@', 1)),
    case when p.id is null then 'Cliente' else 'Barbeiro' end,
    p.id, p.barbearia_id, coalesce(p.id is not null and a.dono, false)
  );
  return new;
end $$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Aplica o acesso (ou a falta dele) a um perfil que já existe: convite para quem já tem conta
-- vira Barbeiro na hora; quem sai da equipe volta a ser Cliente.
create or replace function public.sincronizar_acesso(p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.acessos_profissionais; p public.profissionais;
begin
  if p_email is null then return; end if;
  select * into a from public.acessos_profissionais where email = lower(p_email);
  if a.email is not null then select * into p from public.profissionais where id = a.profissional_id and ativo; end if;
  if p.id is null then
    update public.profiles set papel = 'Cliente', profissional_id = null, barbearia_id = null, dono = false
     where lower(email) = lower(p_email) and papel = 'Barbeiro';
  else
    update public.profiles set papel = 'Barbeiro', profissional_id = p.id, barbearia_id = p.barbearia_id, dono = a.dono
     where lower(email) = lower(p_email);
  end if;
end $$;
revoke all on function public.sincronizar_acesso(text) from public, anon, authenticated;

-- Conta de teste do Nicolas: dona da Procópio (Manauara Shopping).
update public.acessos_profissionais set dono = true where email = 'nicolasduarte.s+barbeiro@gmail.com';
select public.sincronizar_acesso('nicolasduarte.s+barbeiro@gmail.com');

-- ───────────── Auxiliares ─────────────
create or replace function public.minha_barbearia_dono() returns text
language sql stable security definer set search_path = public as $$
  select barbearia_id from public.profiles where id = auth.uid() and papel = 'Barbeiro' and dono
$$;
revoke all on function public.minha_barbearia_dono() from public, anon;
grant execute on function public.minha_barbearia_dono() to authenticated;

create or replace function public.meu_perfil_dono() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro();
begin
  if not me.dono then raise exception 'Apenas o dono da barbearia pode fazer isso.'; end if;
  return me;
end $$;
revoke all on function public.meu_perfil_dono() from public, anon;
grant execute on function public.meu_perfil_dono() to authenticated;

-- ───────────── RLS ─────────────
-- O dono vê as reservas de toda a unidade (o barbeiro continua vendo só as atribuídas a ele).
create policy "reservas da unidade (dono)" on public.agendamentos for select to authenticated
  using (barbearia_id = public.minha_barbearia_dono());

-- Assinatura e pedidos de parceria: só o dono.
drop policy "assinatura da própria unidade" on public.assinaturas;
create policy "assinatura da própria unidade (dono)" on public.assinaturas for select to authenticated
  using (barbearia_id = public.minha_barbearia_dono());
drop policy "parcerias da própria unidade" on public.parcerias;
create policy "parcerias da própria unidade (dono)" on public.parcerias for select to authenticated
  using (barbearia_id = public.minha_barbearia_dono());

-- Foto da unidade: só o dono envia para barbearias/<id>/…
drop policy "enviar a própria foto" on storage.objects;
create policy "enviar a própria foto" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos' and (
      ((storage.foldername(name))[1] = 'perfis' and (storage.foldername(name))[2] = auth.uid()::text)
      or ((storage.foldername(name))[1] = 'barbearias' and (storage.foldername(name))[2] = public.minha_barbearia_dono())
    )
  );

-- ───────────── Funções da unidade passam a ser do dono ─────────────
-- Mesmo corpo de antes (20261123000000_melhorias.sql e 20261127000000_assinaturas_parcerias.sql),
-- trocando a exigência de "barbeiro com vínculo" por "dono da unidade".
do $$
declare f text;
begin
  foreach f in array array[
    'public.atualizar_barbearia(text,text,text)', 'public.salvar_servico(jsonb)', 'public.cancelar_assinatura()',
    'public.solicitar_parceria(int,int)', 'public.encerrar_parceria(uuid)'
  ] loop
    execute replace(pg_get_functiondef(f::regprocedure), 'public.meu_perfil_barbeiro()', 'public.meu_perfil_dono()');
  end loop;
end $$;

create or replace function public.atualizar_foto_barbearia(p_barbearia text, p_foto text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_dono();
begin
  if me.barbearia_id is distinct from p_barbearia then raise exception 'Apenas o dono da barbearia pode alterar a foto.'; end if;
  if p_foto is not null and (p_foto !~ '^https://' or length(p_foto) > 2000) then raise exception 'Envie a foto de novo.'; end if;
  update public.barbearias set foto_capa = p_foto where id = p_barbearia;
end $$;

-- Igual ao anterior, só do dono e contando apenas os barbeiros ativos.
create or replace function public.escolher_plano(p_plano text) returns public.assinaturas
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_dono(); pl public.planos; a public.assinaturas; equipe int;
begin
  select * into pl from public.planos where id = p_plano and ativo;
  if pl.id is null then raise exception 'Plano não encontrado.'; end if;
  select count(*) into equipe from public.profissionais where barbearia_id = me.barbearia_id and ativo;
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

-- ───────────── Agenda: o barbeiro cuida da própria, o dono da de qualquer um da equipe ─────────────
-- Profissional que o usuário logado pode gerenciar: ele mesmo, ou (dono) alguém ativo da unidade.
create or replace function public.exigir_gestao_profissional(p_profissional text) returns public.profissionais
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_barbeiro(); p public.profissionais;
begin
  select * into p from public.profissionais where id = coalesce(p_profissional, me.profissional_id);
  if p.id is null then raise exception 'Profissional não encontrado.'; end if;
  if p.id = me.profissional_id then return p; end if;
  if not me.dono or p.barbearia_id is distinct from me.barbearia_id or not p.ativo then
    raise exception 'Apenas o dono da barbearia pode gerenciar outros barbeiros.';
  end if;
  return p;
end $$;
revoke all on function public.exigir_gestao_profissional(text) from public, anon;
grant execute on function public.exigir_gestao_profissional(text) to authenticated;

drop function public.salvar_jornada(jsonb);
create function public.salvar_jornada(p_jornada jsonb, p_profissional text default null) returns void
language plpgsql security definer set search_path = public as $$
declare prof public.profissionais := public.exigir_gestao_profissional(p_profissional); dias jsonb; ini text; fim text; passo int;
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
   where id = prof.id;
end $$;

create or replace function public.alternar_bloqueio(p_horario text) returns void
language plpgsql security definer set search_path = public as $$
declare h public.horarios;
begin
  select * into h from public.horarios where id = p_horario for update;
  if h.id is null then raise exception 'Horário não encontrado.'; end if;
  perform public.exigir_gestao_profissional(h.profissional_id);
  if h.status = 'Ocupado' then raise exception 'Horário ocupado por uma reserva.'; end if;
  update public.horarios set status = case when h.status = 'Livre' then 'Bloqueado' else 'Livre' end where id = h.id;
end $$;

create or replace function public.encerrar_atendimento(p_id uuid, p_resultado text) returns void
language plpgsql security definer set search_path = public as $$
declare a public.agendamentos; me public.profiles;
begin
  if p_resultado not in ('Finalizado', 'Não compareceu') then raise exception 'Resultado inválido.'; end if;
  select * into a from public.agendamentos where id = p_id for update;
  if a.id is null then raise exception 'Agendamento não encontrado.'; end if;
  select * into me from public.profiles where id = auth.uid();
  if a.profissional_id is distinct from public.meu_profissional_id()
     and not (me.dono and me.papel = 'Barbeiro' and me.barbearia_id = a.barbearia_id) then
    raise exception 'Apenas o profissional atribuído ou o dono podem encerrar o atendimento.';
  end if;
  if a.status <> 'Confirmado' then raise exception 'Só reservas confirmadas podem ser encerradas.'; end if;
  if a.inicio > now() then raise exception 'O atendimento ainda não começou.'; end if;
  update public.agendamentos set status = p_resultado, atualizado_em = now() where id = a.id;
end $$;

-- Barbeiro removido não abre mais horários.
do $$
begin
  execute replace(
    pg_get_functiondef('public.preparar_horarios(text,date)'::regprocedure),
    'if prof.id is null then raise exception ''Profissional não encontrado.''; end if;',
    'if prof.id is null or not prof.ativo then raise exception ''Profissional não encontrado.''; end if;'
  );
end $$;

-- Conta de barbeiro só reserva na própria barbearia; e não se reserva com barbeiro removido.
create or replace function public.regras_reserva_barbearia() returns trigger
language plpgsql security definer set search_path = public as $$
declare ate timestamptz; pct int; cli public.profiles;
begin
  if new.status <> 'Confirmado' then return new; end if;
  if tg_op = 'UPDATE' and new.horario_id = old.horario_id then return new; end if;
  select * into cli from public.profiles where id = new.cliente_id;
  if cli.papel = 'Barbeiro' and cli.barbearia_id is distinct from new.barbearia_id then
    raise exception 'Contas de barbeiro só acessam a própria barbearia.';
  end if;
  if not exists (select 1 from public.profissionais where id = new.profissional_id and ativo) then
    raise exception 'Este barbeiro não atende mais nesta unidade.';
  end if;
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

-- ───────────── Equipe (só o dono) ─────────────
-- E-mails de acesso da equipe e se cada um já entrou no app. Os e-mails continuam fora da API pública.
create or replace function public.minha_equipe()
returns table (profissional_id text, email text, tem_conta boolean, dono boolean)
language sql stable security definer set search_path = public as $$
  select p.id, a.email, exists (select 1 from public.profiles pf where lower(pf.email) = a.email), coalesce(a.dono, false)
    from public.profissionais p
    left join public.acessos_profissionais a on a.profissional_id = p.id
   where p.barbearia_id = (public.meu_perfil_dono()).barbearia_id and p.ativo
$$;

-- Adiciona ou edita um barbeiro. O e-mail é o convite: quem entrar com ele vira barbeiro da unidade.
create or replace function public.salvar_profissional(p_profissional jsonb) returns public.profissionais
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_dono(); r public.profissionais; pl public.planos;
  v_id text := nullif(p_profissional->>'id', '');
  v_nome text := trim(coalesce(p_profissional->>'nome', ''));
  v_desc text := left(trim(coalesce(p_profissional->>'descricao', '')), 200);
  v_esp text := left(trim(coalesce(p_profissional->>'especialidades', '')), 120);
  v_email text := nullif(lower(trim(coalesce(p_profissional->>'email', ''))), '');
  antigo text; equipe int;
begin
  if length(v_nome) not between 2 and 60 then raise exception 'Informe o nome do barbeiro (2 a 60 letras).'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if v_email is not null and exists (select 1 from public.acessos_profissionais where email = v_email and profissional_id is distinct from v_id) then
    raise exception 'Este e-mail já é usado por outro barbeiro.';
  end if;
  if v_email is not null and exists (select 1 from public.profiles where lower(email) = v_email and papel = 'Barbeiro' and profissional_id is distinct from v_id) then
    raise exception 'Este e-mail já é de um barbeiro de outra barbearia.';
  end if;

  if v_id is null then
    select pl2.* into pl from public.assinaturas a join public.planos pl2 on pl2.id = a.plano_id where a.barbearia_id = me.barbearia_id;
    select count(*) into equipe from public.profissionais where barbearia_id = me.barbearia_id and ativo;
    if pl.id is not null and pl.max_profissionais > 0 and equipe >= pl.max_profissionais then
      raise exception 'O plano % permite até % barbeiros. Troque de plano para adicionar mais.', pl.nome, pl.max_profissionais;
    end if;
    insert into public.profissionais (id, nome, descricao, especialidades, barbearia_id)
    values ('prof-' || left(replace(gen_random_uuid()::text, '-', ''), 8), v_nome, v_desc, v_esp, me.barbearia_id)
    returning * into r;
  else
    update public.profissionais set nome = v_nome, descricao = v_desc, especialidades = v_esp
     where id = v_id and barbearia_id = me.barbearia_id and ativo
    returning * into r;
    if r.id is null then raise exception 'Barbeiro não encontrado.'; end if;
  end if;

  select email into antigo from public.acessos_profissionais where profissional_id = r.id;
  if antigo is distinct from v_email then
    if r.id = me.profissional_id then raise exception 'Seu próprio e-mail de acesso não pode ser trocado aqui.'; end if;
    delete from public.acessos_profissionais where profissional_id = r.id;
    if v_email is not null then
      insert into public.acessos_profissionais (email, profissional_id) values (v_email, r.id);
    end if;
    perform public.sincronizar_acesso(antigo);
    perform public.sincronizar_acesso(v_email);
  end if;
  return r;
end $$;

-- Tira o barbeiro da equipe: sai do catálogo, perde o acesso e os horários futuros livres somem.
-- O histórico (reservas antigas e avaliações) fica.
create or replace function public.remover_profissional(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.meu_perfil_dono(); p public.profissionais; antigo text;
begin
  select * into p from public.profissionais where id = p_id and barbearia_id = me.barbearia_id and ativo for update;
  if p.id is null then raise exception 'Barbeiro não encontrado.'; end if;
  if p.id = me.profissional_id then raise exception 'Você não pode remover a si mesmo.'; end if;
  if exists (select 1 from public.agendamentos where profissional_id = p.id and status = 'Confirmado') then
    raise exception 'Este barbeiro tem reservas confirmadas ou pendentes de finalizar. Resolva-as antes de remover.';
  end if;
  update public.profissionais set ativo = false where id = p.id;
  update public.horarios h set status = 'Bloqueado'
   where h.profissional_id = p.id and h.inicio > now() and h.status = 'Livre'
     and exists (select 1 from public.agendamentos a where a.horario_id = h.id);
  delete from public.horarios h
   where h.profissional_id = p.id and h.inicio > now() and h.status = 'Livre';
  select email into antigo from public.acessos_profissionais where profissional_id = p.id;
  delete from public.acessos_profissionais where profissional_id = p.id;
  perform public.sincronizar_acesso(antigo);
end $$;

revoke all on function public.minha_equipe(), public.salvar_profissional(jsonb), public.remover_profissional(text),
  public.salvar_jornada(jsonb, text) from public, anon;
grant execute on function public.minha_equipe(), public.salvar_profissional(jsonb), public.remover_profissional(text),
  public.salvar_jornada(jsonb, text) to authenticated;
