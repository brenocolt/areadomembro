const { Client } = require('pg')

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  await client.connect()
  const res = await client.query(`
    SELECT id, nome FROM membros_pre_cadastro 
    WHERE nome ILIKE '%gabriel%' OR nome ILIKE '%ana%'
  `)
  console.log("Found:", res.rows)
  await client.end()
}
run()
