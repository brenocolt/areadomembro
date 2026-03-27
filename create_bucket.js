import { createClient } from '@supabase/supabase-js';

// Get args from ENV or simple require
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.storage.createBucket('comprovantes', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    fileSizeLimit: 5242880 // 5MB
  });
  console.log('Create Bucket Data:', data);
  console.log('Create Bucket Error:', error);

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  console.log('Buckets:', buckets, listError);
}

main();
