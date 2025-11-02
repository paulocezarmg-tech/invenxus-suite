-- Tornar product_id nullable para permitir movimentações de kits
ALTER TABLE public.movements ALTER COLUMN product_id DROP NOT NULL;