-- Add new fields to products table for cost and sale price
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS custo_unitario numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_venda numeric DEFAULT 0;

-- Add additional costs field to financeiro table
ALTER TABLE public.financeiro
ADD COLUMN IF NOT EXISTS custos_adicionais jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS custo_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS preco_venda numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS lucro_liquido numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS margem_percentual numeric DEFAULT 0;

-- Add additional costs field to kits table
ALTER TABLE public.kits
ADD COLUMN IF NOT EXISTS custos_adicionais jsonb DEFAULT '[]'::jsonb;

-- Update existing products to copy cost to custo_unitario
UPDATE public.products
SET custo_unitario = cost
WHERE custo_unitario = 0 AND cost > 0;