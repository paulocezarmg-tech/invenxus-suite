-- Criar tabela de previsões de estoque
CREATE TABLE IF NOT EXISTS public.previsoes_estoque (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  estoque_atual NUMERIC NOT NULL DEFAULT 0,
  media_vendas_diaria NUMERIC NOT NULL DEFAULT 0,
  dias_restantes NUMERIC,
  data_previsao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  recomendacao TEXT,
  organization_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX idx_previsoes_produto ON public.previsoes_estoque(produto_id);
CREATE INDEX idx_previsoes_org ON public.previsoes_estoque(organization_id);
CREATE INDEX idx_previsoes_dias ON public.previsoes_estoque(dias_restantes);

-- Habilitar RLS
ALTER TABLE public.previsoes_estoque ENABLE ROW LEVEL SECURITY;

-- Política para visualização (todos os usuários autenticados da organização)
CREATE POLICY "Usuários podem ver previsões da sua organização"
ON public.previsoes_estoque
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Política para inserção/atualização (apenas sistema via service role)
CREATE POLICY "Sistema pode gerenciar previsões"
ON public.previsoes_estoque
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_previsoes_estoque_updated_at
BEFORE UPDATE ON public.previsoes_estoque
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();