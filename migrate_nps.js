const { Client } = require('pg')

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  await client.connect()
  try {
    await client.query(`
      ALTER TABLE avaliacoes_nps 
      ADD COLUMN IF NOT EXISTS suporte numeric,
      ADD COLUMN IF NOT EXISTS relacionamento numeric,
      ADD COLUMN IF NOT EXISTS resolutividade numeric,
      ADD COLUMN IF NOT EXISTS lideranca numeric;
    `)
    console.log("avaliacoes_nps altered successfully.")
    
    await client.query(`
      ALTER TABLE membros_pre_cadastro
      ADD COLUMN IF NOT EXISTS nps_data jsonb DEFAULT '[]'::jsonb;
    `)
    console.log("membros_pre_cadastro altered successfully.")
    
  } catch(e) {
    console.error(e)
  }
  await client.end()
}
run()
