const { Client } = require('pg');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
const env = envFile.split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) {
    let val = v.join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    acc[k.trim()] = val;
  }
  return acc;
}, {});

async function main() {
  const client = new Client({
    connectionString: env.DATABASE_URL
  });

  await client.connect();

  console.log('Altering UUID to Text...');
  try {
    await client.query(`ALTER TABLE public.avaliacoes_nps DROP CONSTRAINT IF EXISTS avaliacoes_nps_projeto_id_fkey;`);
    await client.query(`ALTER TABLE public.nps_projeto_submissoes DROP CONSTRAINT IF EXISTS nps_projeto_submissoes_projeto_id_fkey;`);
    console.log('Dropped FKs');

    await client.query(`ALTER TABLE public.projetos ALTER COLUMN id TYPE text;`);
    console.log('Altered projetos.id to text');
    
    await client.query(`ALTER TABLE public.avaliacoes_nps ALTER COLUMN projeto_id TYPE text;`);
    console.log('Altered avaliacoes_nps.projeto_id to text');

    await client.query(`ALTER TABLE public.nps_projeto_submissoes ALTER COLUMN projeto_id TYPE text;`);
    console.log('Altered nps_projeto_submissoes.projeto_id to text');

    // add back FK
    await client.query(`
      ALTER TABLE public.avaliacoes_nps 
        ADD CONSTRAINT avaliacoes_nps_projeto_id_fkey 
        FOREIGN KEY (projeto_id) REFERENCES public.projetos (id);
    `);
    
    await client.query(`
      ALTER TABLE public.nps_projeto_submissoes 
        ADD CONSTRAINT nps_projeto_submissoes_projeto_id_fkey 
        FOREIGN KEY (projeto_id) REFERENCES public.projetos (id);
    `);
    console.log('Added FKs back');

  } catch (e) {
    console.error('Error altering:', e.message);
  } finally {
    await client.end();
  }
}

main();
