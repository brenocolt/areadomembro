import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://vsvfldstgqnjnnyehrmu.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'ey...') // I need to get the real URL/key from env

const getInfo = async () => {
}
