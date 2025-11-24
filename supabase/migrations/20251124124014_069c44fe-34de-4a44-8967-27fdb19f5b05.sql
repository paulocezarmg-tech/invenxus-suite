-- Add logo_url column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN logo_url TEXT;

-- Create storage bucket for supplier logos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-logos', 'supplier-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for supplier logos
CREATE POLICY "Supplier logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'supplier-logos');

CREATE POLICY "Authenticated users can upload supplier logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'supplier-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update supplier logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'supplier-logos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete supplier logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'supplier-logos' 
  AND auth.role() = 'authenticated'
);