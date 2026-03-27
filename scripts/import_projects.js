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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MONDAY_TOKEN = env.MONDAY_API_TOKEN;
const MONDAY_BOARD_ID = env.MONDAY_BOARD_ID;

async function run() {
  console.log('Fetching Monday projects...');
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': MONDAY_TOKEN,
      'API-Version': '2023-10'
    },
    body: JSON.stringify({
      query: `
        query {
          boards(ids: ${MONDAY_BOARD_ID}) {
            items_page(limit: 500) {
              items {
                id
                name
              }
            }
          }
        }
      `
    })
  });

  const json = await res.json();
  if (json.errors) {
    console.error('Monday error', json.errors);
    return;
  }

  const items = json.data.boards[0].items_page.items;
  console.log(`Found ${items.length} projects in Monday!`);

  console.log('Inserting into Supabase...');
  for (const item of items) {
    const proj = { id: String(item.id), nome: item.name, status: 'Ativo' };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/projetos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(proj)
    });
    
    if (!r.ok) {
      console.log('Error inserting:', item.name, await r.text());
    }
  }

  console.log('Done!');
}

run();
