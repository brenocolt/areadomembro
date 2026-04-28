import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
  const { data, error } = await supabase
    .from('solicitacoes_saque')
    .select('*, colaboradores(nome, email_corporativo)')
    .eq('tipo', 'saque_pipj')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(JSON.stringify(data, null, 2));
}

test();
