const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envConfig = dotenv.parse(fs.readFileSync('.env'))
for (const k in envConfig) {
  process.env[k] = envConfig[k]
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function main() {
  const { data, error } = await supabase.from('projetos').select('*')
  console.log('Projetos fetched:', data?.length)
  console.log('Sample:', data?.[0])
}
main()
