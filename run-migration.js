const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
    const client = new Client({
        connectionString: 'postgresql://postgres.jskzxtpabmwvmgnuhbjf:Produtivajr12*@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected to Supabase');

        const fileName = process.argv[2] || 'supabase/migrations/002_seed_data.sql';
        const sql = fs.readFileSync(
            path.join(__dirname, fileName),
            'utf8'
        );
        await client.query(sql);
        console.log(`✅ Migration ${fileName} executed successfully!`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

main();
