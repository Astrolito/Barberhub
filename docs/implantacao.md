# Implantação e operação

| Peça | Onde |
|---|---|
| Site em produção | https://barberhub-one.vercel.app (Vercel, deploy automático a cada push na `main`) |
| Backend | Projeto Supabase `barberhub`, região São Paulo (`sa-east-1`), plano gratuito |
| Código | https://github.com/Astrolito/barberhub |
| CI | GitHub Actions (`.github/workflows/ci.yml`): testes + build em cada PR e push na `main` |

## Supabase

### Criar o banco do zero

1. Crie um projeto no Supabase.
2. Aplique os arquivos de `supabase/migrations/` em ordem e depois `supabase/seed.sql`, pelo SQL Editor ou com a CLI (`supabase db push`).
3. Em **Authentication > URL Configuration**, defina o *Site URL* como o domínio da Vercel (`https://barberhub-one.vercel.app`) e adicione-o em *Redirect URLs*. Para desenvolvimento, adicione também `http://localhost:5173`.
4. Em **Authentication > Email Templates > Magic Link**, inclua `{{ .Token }}` no texto, para o e-mail trazer também o código de 6 dígitos (necessário no app instalado, onde o link não volta para o app).
5. Copie a *Project URL* e a chave pública (*anon/publishable*) para as variáveis do front-end.

O que cada tabela e função faz está em [banco-de-dados.md](banco-de-dados.md).

### Dar acesso de barbeiro

O papel `Barbeiro` vem da tabela `acessos_profissionais`, uma lista de e-mails ligados a um profissional. Ela não é lida pela API pública; edite pelo painel do Supabase (Table Editor ou SQL Editor).

**Antes do primeiro login** da pessoa, cadastre o e-mail (sempre em minúsculas):

```sql
insert into acessos_profissionais (email, profissional_id)
values ('email-do-barbeiro@exemplo.com', 'prof-001')
on conflict (profissional_id) do update set email = excluded.email;
```

Quem entrar com esse e-mail vira Barbeiro vinculado ao profissional (e à unidade dele) e passa a ver a **Área do barbeiro** no menu lateral e no Perfil. Cada profissional tem no máximo um e-mail de acesso.

**Se a pessoa já entrou antes** como cliente, o perfil já foi criado com papel `Cliente` (o papel só é definido no primeiro login). Além do `insert` acima, atualize o perfil pelo SQL Editor:

```sql
update profiles p
set papel = 'Barbeiro', profissional_id = pr.id, barbearia_id = pr.barbearia_id
from profissionais pr
where pr.id = 'prof-001' and lower(p.email) = 'email-do-barbeiro@exemplo.com';
```

Dica para testes: use um alias do mesmo e-mail (por exemplo `seunome+barbeiro@gmail.com`) para ter uma conta de barbeiro sem perder a de cliente.

Os ids dos profissionais (`prof-001`, `prof-002`…) estão em `src/data/seed.ts` e na tabela `profissionais`.

## Cobrança e parcerias

O app não tem gateway de pagamento. A equipe acompanha os pedidos e confirma no **SQL Editor** do Supabase (as funções `admin_*` não são liberadas para a API).

```sql
-- Quem está aguardando pagamento, em teste ou vencendo
select b.nome, a.plano_id, a.status, a.valida_ate
  from assinaturas a join barbearias b on b.id = a.barbearia_id
 order by a.valida_ate;

-- Pagamento recebido: ativa o plano por 1 mês (ou mais), somando ao prazo que restava
select admin_confirmar_pagamento('bb001', 1);

-- Pedidos de parceria em análise
select p.id, b.nome, p.desconto_pct, p.dias, p.criado_em
  from parcerias p join barbearias b on b.id = p.barbearia_id
 where p.status = 'Solicitada';

-- Aprovar (o destaque começa agora) ou recusar
select admin_aprovar_parceria('<id do pedido>');
select admin_recusar_parceria('<id do pedido>');
```

Os preços dos planos ficam na tabela `planos` (`update planos set preco_mensal = 59.90 where id = 'basico';`). Os descontos aceitos (10 a 30%) e os períodos (30 ou 90 dias) estão em `src/domain/rules.ts` e na migração `20261127000000_assinaturas_parcerias.sql`; mude nos dois.

No modo demonstração, a página **Plano e parceria** tem botões "Simular aprovação" e "Simular pagamento confirmado", que fazem o papel da equipe.

## Vercel

1. Importe o repositório em vercel.com/new. O `vercel.json` já define o build (`npm run build`, saída `dist`) e os cabeçalhos de segurança e cache.
2. Em *Settings > Environment Variables*, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e faça um novo deploy. Sem elas, o site publica em modo demonstração.

Cada push na `main` gera um deploy de produção; cada pull request gera uma prévia.

## App Android e iOS (Capacitor)

A configuração está em `capacitor.config.ts` (`appId: br.com.barberhub.app`). O projeto Android já está em `android/`, com as permissões de localização e de notificação.

```bash
npm run android   # build + sync + abre o Android Studio (depois: Run ▶)
npx cap add ios   # uma vez; requer macOS + Xcode
npm run ios       # build + sync + abre o Xcode
```

No iOS, adicione `NSLocationWhenInUseUsageDescription` no `Info.plist` depois do `cap add ios`. As variáveis do `.env` entram no build, então gere o app com elas definidas para usar o Supabase.

## Operação

- **Pausa do plano gratuito.** O Supabase pausa projetos gratuitos depois de cerca de uma semana sem acesso. Com o banco pausado, o login e as reservas falham no site. Para reativar: painel do Supabase > projeto `barberhub` > *Restore project* (gratuito, leva alguns minutos). Os dados são mantidos.
- **Mudar regras.** Os limites (2h para cancelar/remarcar, 3 reservas futuras) estão em `src/domain/rules.ts` e nas funções SQL. Mude nos dois lugares e crie uma nova migração em vez de editar as antigas.
- **Mudar o catálogo inicial.** Edite `src/data/seed.ts` e gere o SQL com `node scripts/gerar-seed-sql.mjs`.
- **Segurança.** Depois de mudar o esquema, rode o *Security Advisor* do Supabase. Nunca coloque a chave `service_role` no front-end nem no repositório.
