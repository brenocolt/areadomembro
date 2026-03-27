import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function run() {
    const { error } = await supabase.from('avaliacoes_nps').insert([{ mes: 'wrong' }])
    console.log(error)
}
run()
