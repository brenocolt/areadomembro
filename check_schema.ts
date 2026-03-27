import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function getColumns() {
    const { data, error } = await supabase.rpc('get_columns_dummy', {}) // Or I can just fetch by inspecting postgrest...
}

// Since we cannot run RPC if not defined, let's just make a fetch call using the admin key maybe? No, anon key is fine if we can hit the metadata endpoint? No, we can't. Let me find where `avaliacoes_nps` is inserted to check its TypeScript types!
