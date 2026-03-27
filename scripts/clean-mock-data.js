const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function format() {
    const tables = [
        'ocorrencias',
        'milhas_trocas',
        'solicitacoes_saque',
        'solicitacoes_remocao',
    ];

    // We just delete everything from these tables to give it a clean slate
    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log(`Cleared ${table}:`, error ? error.message : 'Success');
    }

    // Also set all pontos_negativos to 0 and milhas_saldo to 0
    const { error: err1 } = await supabase.from('colaboradores').update({ pontos_negativos: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Reset pontos_negativos:', err1 ? err1.message : 'Success');

    const { error: err2 } = await supabase.from('milhas_saldo').update({ saldo_disponivel: 0, milhas_acumuladas: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Reset milhas_saldo:', err2 ? err2.message : 'Success');

    // Get valid user IDs
    const { data: users } = await supabase.from('users').select('id');
    const validIds = users.map(u => u.id);

    // Delete fake colaboradores (those not in users table)
    if (validIds.length > 0) {
        // Do not delete rows where email is produtivajunior@gmail.com, just in case
        const { error: err3 } = await supabase
            .from('colaboradores')
            .delete()
            .not('id', 'in', `(${validIds.join(',')})`)
            .neq('email_corporativo', 'produtivajunior@gmail.com');
        console.log('Deleted fake colaboradores:', err3 ? err3.message : 'Success');
    } else {
        const { error: err3 } = await supabase
            .from('colaboradores')
            .delete()
            .neq('email_corporativo', 'produtivajunior@gmail.com');
        console.log('Deleted fake colaboradores:', err3 ? err3.message : 'Success');
    }
}

format().then(() => console.log('Cleaned up mock data.'));
