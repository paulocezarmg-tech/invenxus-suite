-- Add preco_venda field to kits table
ALTER TABLE public.kits
ADD COLUMN IF NOT EXISTS preco_venda numeric DEFAULT 0;

-- Update custos_adicionais to ensure it's jsonb if not already
-- (already exists but ensuring structure)