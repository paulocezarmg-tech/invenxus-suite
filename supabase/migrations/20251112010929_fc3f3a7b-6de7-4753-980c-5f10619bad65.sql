-- Adicionar coluna para armazenar URLs de anexos na tabela contas
ALTER TABLE public.contas
ADD COLUMN anexos jsonb DEFAULT '[]'::jsonb;

-- Criar bucket para documentos de contas
INSERT INTO storage.buckets (id, name, public)
VALUES ('conta-documentos', 'conta-documentos', false);

-- Políticas RLS para o bucket conta-documentos
CREATE POLICY "Usuários podem fazer upload de documentos de contas da sua org"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'conta-documentos' AND
  (storage.foldername(name))[1] = get_user_organization_id(auth.uid())::text
);

CREATE POLICY "Usuários podem visualizar documentos de contas da sua org"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'conta-documentos' AND
  (storage.foldername(name))[1] = get_user_organization_id(auth.uid())::text
);

CREATE POLICY "Usuários podem deletar documentos de contas da sua org"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'conta-documentos' AND
  (storage.foldername(name))[1] = get_user_organization_id(auth.uid())::text
);