-- Bucket de fotos de perfil — usado pelo upload de foto na página de Perfil
-- (ver src/app/(dashboard)/profile/components/profile-card.tsx). Mesmo
-- padrão do bucket "comprovantes" (003_add_comprovante_to_milhas.sql), com
-- nomes de política PRÓPRIOS (não reaproveita "Public Access"/"Authenticated
-- users can upload" — são políticas por bucket, e usar o mesmo nome faria o
-- CREATE POLICY de um bucket derrubar a policy do outro).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatars Public Access" ON storage.objects;
CREATE POLICY "Avatars Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars Authenticated Upload" ON storage.objects;
CREATE POLICY "Avatars Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatars Authenticated Update" ON storage.objects;
CREATE POLICY "Avatars Authenticated Update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
