const { Client } = require('pg')

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  await client.connect()
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'avaliacoes_nps'
  `)
  console.log("avaliacoes_nps schema:", res.rows)
  
  const res2 = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'membros_pre_cadastro'
  `)
  console.log("membros_pre_cadastro schema:", res2.rows)
  
  await client.end()
}
run()
