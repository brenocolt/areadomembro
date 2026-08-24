// Conferência somente-leitura do schema: diz quais migrações já estão no
// banco e quais ainda faltam. Não altera nada.
//
//   node scripts/check-migrations.js
//
// Existe porque "aplicar a migração" e "a migração ter sido aplicada" são
// coisas diferentes: o PostgREST recusa a requisição inteira quando ela cita
// uma coluna ou tabela que não existe, e o resultado chega às telas como
// "nenhum registro" — foi assim que a Gestão de Formulários apareceu vazia
// com todos os formulários intactos no banco.
const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL
    || 'postgresql://postgres.jskzxtpabmwvmgnuhbjf:Produtivajr12*@aws-1-us-east-2.pooler.supabase.com:5432/postgres';

// Cada migração é identificada pelo que ela cria — é o que as telas realmente
// exigem, independente de qualquer registro de "migração aplicada".
const MIGRACOES = [
    {
        arquivo: 'supabase/migrations/20260824_formularios_publico.sql',
        descricao: 'Público do formulário (Quem Responde / Quem Recebe) e abas por pessoa',
        tabelas: ['formulario_publico_responde', 'formulario_publico_recebe'],
        colunas: [['formulario_respostas', 'alvo_colaborador_id']],
    },
    {
        arquivo: 'supabase/migrations/20260825_formularios_subabas_competencias.sql',
        descricao: 'Sub-abas em Performance, competência e "Não avaliar"',
        tabelas: [],
        colunas: [
            ['formularios', 'gerar_subaba'],
            ['formulario_perguntas', 'competencia'],
            ['formulario_perguntas', 'permite_nao_avaliar'],
        ],
    },
];

async function main() {
    const client = new Client({ connectionString: CONNECTION_STRING, ssl: { rejectUnauthorized: false } });
    await client.connect();

    try {
        const { rows: [contagem] } = await client.query('SELECT count(*)::int AS total FROM formularios');
        console.log(`\nFormulários no banco: ${contagem.total}`);
        if (contagem.total === 0) {
            console.log('  ⚠️  A tabela está vazia. Isso é perda de dados no banco, não problema de leitura —');
            console.log('      restaure um backup/PITR pelo painel do Supabase.');
        }

        const { rows: porStatus } = await client.query(
            'SELECT status, count(*)::int AS total FROM formularios GROUP BY status ORDER BY status'
        );
        for (const r of porStatus) console.log(`  ${r.status}: ${r.total}`);

        let faltando = 0;
        for (const m of MIGRACOES) {
            const ausentes = [];

            for (const tabela of m.tabelas) {
                const { rows } = await client.query('SELECT to_regclass($1) AS existe', [`public.${tabela}`]);
                if (!rows[0].existe) ausentes.push(`tabela ${tabela}`);
            }
            for (const [tabela, coluna] of m.colunas) {
                const { rows } = await client.query(
                    'SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
                    ['public', tabela, coluna]
                );
                if (rows.length === 0) ausentes.push(`coluna ${tabela}.${coluna}`);
            }

            console.log(`\n${ausentes.length === 0 ? '✅' : '❌'} ${m.arquivo}`);
            console.log(`   ${m.descricao}`);
            if (ausentes.length > 0) {
                faltando++;
                console.log(`   Falta no banco: ${ausentes.join(', ')}`);
                console.log(`   Para aplicar:   node run-migration.js ${m.arquivo}`);
            }
        }

        console.log(faltando === 0
            ? '\nTudo aplicado — nenhuma migração pendente.\n'
            : `\n${faltando} migração(ões) pendente(s). Rode os comandos acima, na ordem, e execute este script de novo.\n`);

        process.exitCode = faltando === 0 ? 0 : 1;
    } finally {
        await client.end();
    }
}

main().catch((err) => {
    console.error('❌ Não foi possível consultar o banco:', err.message);
    process.exit(1);
});
