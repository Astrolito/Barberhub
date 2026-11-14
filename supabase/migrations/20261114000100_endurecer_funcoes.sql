-- Recomendações do Security Advisor do Supabase.
alter function public.proteger_perfil() set search_path = public;
-- Função de trigger: não precisa ser chamável pela API.
revoke all on function public.handle_new_user() from public, anon, authenticated;
-- Usada pela policy de agendamentos: só usuários logados.
revoke all on function public.meu_profissional_id() from public, anon;
grant execute on function public.meu_profissional_id() to authenticated;
