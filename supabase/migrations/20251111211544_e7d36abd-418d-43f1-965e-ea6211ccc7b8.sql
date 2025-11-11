-- Adicionar campo de perda financeira na tabela de previsões
ALTER TABLE public.previsoes_estoque 
ADD COLUMN IF NOT EXISTS perda_financeira NUMERIC DEFAULT 0;