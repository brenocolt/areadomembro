// Banco PostgreSQL de verdade, em memória (PGlite), com o mínimo do ambiente Supabase do portal:
// papéis, função compartilhada de updated_at e as tabelas existentes que a aba consulta.
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const MIGRATION = fs.readFileSync(path.join(raiz, 'supabase/migrations/20261020_reconhecimentos_bonificacoes.sql'), 'utf8')
export const ROLLBACK = fs.readFileSync(path.join(raiz, 'supabase/rollbacks/20261020_reconhecimentos_bonificacoes_ROLLBACK.sql'), 'utf8')
export const TABELAS = ['reconhecimento_tipos', 'reconhecimento_nucleos', 'reconhecimentos', 'regras_bonificacao', 'bonificacoes', 'bonificacao_entregas', 'reconhecimento_historico']

export const PARTE_BASE = {
    papeis: `CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;`,
    funcao: `CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`,
    tabelas: `
        CREATE TABLE public.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, role text NOT NULL DEFAULT 'COLABORADOR', colaborador_id uuid, senha text DEFAULT 'x');
        CREATE TABLE public.colaboradores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, email_corporativo text UNIQUE NOT NULL,
            nucleo_atual text NOT NULL DEFAULT 'Marketing', cargo_atual text NOT NULL DEFAULT 'Operacional', status text DEFAULT 'Ativo', paginas_permitidas text[] DEFAULT '{}');
        CREATE TABLE public.projetos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text UNIQUE NOT NULL, status text DEFAULT 'Ativo');`,
}

export async function novoBanco({ semFuncao = false, comTabelas = true } = {}) {
    const db = new PGlite()
    await db.exec(PARTE_BASE.papeis)
    if (!semFuncao) await db.exec(PARTE_BASE.funcao)
    if (comTabelas) await db.exec(PARTE_BASE.tabelas)
    return db
}

export async function bancoComMigration(opcoes) {
    const db = await novoBanco(opcoes)
    await db.exec(MIGRATION)
    return db
}

// Simula os cabeçalhos que o PostgREST expõe ao banco (o servidor do portal envia o autor).
export const comAutor = (db, email = 'vp@pj.com', id = '00000000-0000-4000-8000-0000000000aa') =>
    db.query(`select set_config('request.headers', $1, false)`, [JSON.stringify({ 'x-app-usuario-email': email, 'x-app-usuario-id': id })])
