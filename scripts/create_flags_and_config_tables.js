const { Client } = require('pg');

async function createTables() {
    const connectionString = process.env.DATABASE_URL.replace('?pgbouncer=true', '');
    const client = new Client({
        connectionString,
    });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL");

        const setupQuery = `
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            INSERT INTO configuracoes (chave, valor) 
            VALUES ('nps_projeto_ativo', 'true'::jsonb) 
            ON CONFLICT (chave) DO NOTHING;

            CREATE TABLE IF NOT EXISTS flags (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
                criador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
                cor TEXT NOT NULL,
                motivo TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `;

        await client.query(setupQuery);
        console.log("Tables 'configuracoes' and 'flags' created successfully (or already exist).");

    } catch (err) {
        console.error("Error creating tables:", err);
    } finally {
        await client.end();
    }
}

createTables();
