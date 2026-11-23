// Gera supabase/seed.sql a partir de src/data/seed.ts (mesma fonte para os dois modos).
// Uso: node scripts/gerar-seed-sql.mjs
import { build } from 'vite'
import { writeFileSync } from 'node:fs'

const out = await build({
  logLevel: 'silent',
  build: { lib: { entry: 'src/data/seed.ts', formats: ['es'], fileName: 'seed' }, write: false, outDir: '.tmp-seed' },
})
const code = out[0].output[0].code
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const db = mod.criarSeed()
const q = (v) => (v === undefined || v === null ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`)
const linhas = ['-- Gerado por scripts/gerar-seed-sql.mjs. Não edite à mão.', '']
for (const b of db.barbearias)
  linhas.push(`insert into public.barbearias (id,nome,endereco,cidade,bairro,descricao,lat,lng,marca) values (${[b.id, b.nome, b.endereco, b.cidade, b.bairro, b.descricao, b.lat, b.lng].map(q).join(',')},${q(JSON.stringify(b.marca))}::jsonb) on conflict (id) do nothing;`)
for (const p of db.profissionais)
  linhas.push(`insert into public.profissionais (id,nome,descricao,especialidades,barbearia_id) values (${[p.id, p.nome, p.descricao, p.especialidades, p.barbeariaId].map(q).join(',')}) on conflict (id) do nothing;`)
// E-mail de acesso fica numa tabela sem leitura pública.
for (const p of db.profissionais.filter((x) => x.emailAcesso))
  linhas.push(`insert into public.acessos_profissionais (email,profissional_id) values (${[p.emailAcesso.toLowerCase(), p.id].map(q).join(',')}) on conflict do nothing;`)
for (const s of db.servicos)
  linhas.push(`insert into public.servicos (id,barbearia_id,nome,descricao,preco,duracao_minutos,categoria,inclui,disponivel,icone) values (${[s.id, s.barbeariaId, s.nome, s.descricao, s.preco, s.duracaoMinutos, s.categoria, s.inclui, s.disponivel, s.icone].map(q).join(',')}) on conflict (id) do nothing;`)
writeFileSync('supabase/seed.sql', linhas.join('\n') + '\n')
console.log('supabase/seed.sql gerado')
