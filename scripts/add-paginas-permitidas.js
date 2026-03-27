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

  console.log('Adding paginas_permitidas column to colaboradores...');
  try {
    await client.query(`ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS paginas_permitidas text[] DEFAULT NULL;`);
    console.log('✅ Column paginas_permitidas added successfully!');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.end();
  }
}

main();
