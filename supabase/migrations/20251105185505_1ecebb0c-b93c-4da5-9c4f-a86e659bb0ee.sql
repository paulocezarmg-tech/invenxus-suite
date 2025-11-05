-- Tornar o bucket de avatars público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- Remover políticas antigas do bucket avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Criar políticas RLS para o bucket de avatars
-- Qualquer pessoa autenticada pode visualizar avatars
CREATE POLICY "Avatars são publicamente acessíveis"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Usuários podem fazer upload de seus próprios avatars
CREATE POLICY "Usuários podem fazer upload de seu próprio avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuários podem atualizar seus próprios avatars
CREATE POLICY "Usuários podem atualizar seu próprio avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Usuários podem deletar seus próprios avatars
CREATE POLICY "Usuários podem deletar seu próprio avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);