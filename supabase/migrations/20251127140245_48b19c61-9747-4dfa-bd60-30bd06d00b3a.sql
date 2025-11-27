-- Criar tabela para histórico de recomendações de preço
CREATE TABLE IF NOT EXISTS public.recomendacoes_preco (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  produto_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN ('produto', 'kit')),
  preco_atual NUMERIC NOT NULL,
  preco_recomendado NUMERIC NOT NULL,
  lucro_potencial NUMERIC,
  impacto_demanda TEXT CHECK (impacto_demanda IN ('baixo', 'moderado', 'alto')),
  analise_completa TEXT NOT NULL,
  aplicado BOOLEAN NOT NULL DEFAULT false,
  data_aplicacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recomendacoes_preco ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver recomendações da sua organização"
  ON public.recomendacoes_preco
  FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operadores podem inserir recomendações na sua organização"
  ON public.recomendacoes_preco
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) AND
    user_id = auth.uid() AND
    (has_role(auth.uid(), 'operador'::app_role) OR 
     has_role(auth.uid(), 'almoxarife'::app_role) OR 
     has_role(auth.uid(), 'admin'::app_role) OR 
     has_role(auth.uid(), 'superadmin'::app_role))
  );

CREATE POLICY "Admins podem atualizar recomendações da sua organização"
  ON public.recomendacoes_preco
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid()) AND
    (has_role(auth.uid(), 'admin'::app_role) OR 
     has_role(auth.uid(), 'superadmin'::app_role))
  );

-- Trigger para updated_at
CREATE TRIGGER update_recomendacoes_preco_updated_at
  BEFORE UPDATE ON public.recomendacoes_preco
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();