const { Client } = require('pg');

async function clean() {
    const client = new Client({
        connectionString: 'postgresql://postgres.jskzxtpabmwvmgnuhbjf:Produtivajr12%2A@aws-1-us-east-2.pooler.supabase.com:6543/postgres'
    });

    try {
        await client.connect();

        console.log('Truncating ocorrencias...');
        await client.query('TRUNCATE TABLE ocorrencias CASCADE');

        console.log('Truncating milhas_trocas...');
        await client.query('TRUNCATE TABLE milhas_trocas CASCADE');

        console.log('Truncating solicitacoes_saque...');
        await client.query('TRUNCATE TABLE solicitacoes_saque CASCADE');

        console.log('Truncating solicitacoes_remocao...');
        await client.query('TRUNCATE TABLE solicitacoes_remocao CASCADE');

        console.log('Resetting pontos_negativos...');
        await client.query('UPDATE colaboradores SET pontos_negativos = 0');

        console.log('Resetting milhas_saldo...');
        await client.query('UPDATE milhas_saldo SET saldo_disponivel = 0, milhas_acumuladas = 0');

        console.log('Deleting fake colaboradores without matching users...');
        await client.query(`
            DELETE FROM colaboradores 
            WHERE id NOT IN (SELECT id FROM users)
            AND email_corporativo != 'produtivajunior@gmail.com'
        `);

        console.log('Successfully cleaned up all mock data!');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await client.end();
    }
}

clean();
