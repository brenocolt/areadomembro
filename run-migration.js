// Aplica um arquivo .sql de supabase/migrations no banco.
//
//   node run-migration.js supabase/migrations/20260825_formularios_subabas_competencias.sql
//
// Para conferir o que já está aplicado antes/depois, use:
//   node scripts/check-migrations.js
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// A senha de produção está versionada aqui desde o início do projeto e
// continua como padrão para não quebrar quem já usa o script. Defina
// DATABASE_URL no ambiente para não depender dela — e troque a senha no
// painel do Supabase, já que esta está exposta no repositório.
const CONNECTION_STRING = process.env.DATABASE_URL
    || 'postgresql://postgres.jskzxtpabmwvmgnuhbjf:Produtivajr12*@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

async function main() {
    const client = new Client({
        connectionString: CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });

    const fileName = process.argv[2] || 'supabase/migrations/002_seed_data.sql';

    try {
        await client.connect();
        console.log('✅ Connected to Supabase');

        const sql = fs.readFileSync(
            path.join(__dirname, fileName),
            'utf8'
        );
        await client.query(sql);
        console.log(`✅ Migration ${fileName} executed successfully!`);

    } catch (err) {
        // Precisa derrubar o processo: antes o erro virava só uma linha no
        // console e o script saía com código 0, então uma migração que falhou
        // passava por aplicada — e o app quebrava depois, longe da causa.
        console.error(`❌ Migration ${fileName} FAILED:`, err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
