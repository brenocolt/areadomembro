import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function main() {
  const { data, error } = await supabase.from('projetos').select('*')
  console.log('Projetos:', data?.length)
  console.log('Error:', error)
}
main()
