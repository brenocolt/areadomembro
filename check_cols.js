const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({path: '.env'})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function getCols() {
  const { data, error } = await supabase.from('avaliacoes_nps').select('*').limit(1)
  if (data?.length > 0) {
    console.log(Object.keys(data[0]))
  } else {
    // try to insert an invalid record to get a postgrest error with details
    const { error: err2 } = await supabase.from('avaliacoes_nps').insert({ test_field: "1" })
    console.log("Error details:", err2)
  }
}
getCols()
