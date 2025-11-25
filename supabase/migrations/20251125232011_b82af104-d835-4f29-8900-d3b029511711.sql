-- Adicionar campos para custos adicionais e preço de venda usado nas movimentações
ALTER TABLE movements 
ADD COLUMN IF NOT EXISTS custos_adicionais jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS preco_venda_usado numeric DEFAULT 0;

COMMENT ON COLUMN movements.custos_adicionais IS 'Custos adicionais da movimentação (frete, impostos, etc)';
COMMENT ON COLUMN movements.preco_venda_usado IS 'Preço de venda usado na movimentação OUT';