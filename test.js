import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data, error } = await supabase.from('milhas_trocas').select('*, colaboradores!inner(nome, cargo_atual, milhas_saldo(saldo_disponivel))').limit(1);
  console.log(JSON.stringify(data, null, 2), error);
})();
