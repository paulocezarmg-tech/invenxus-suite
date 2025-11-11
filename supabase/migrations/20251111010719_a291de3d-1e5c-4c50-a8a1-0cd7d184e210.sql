-- Criar tabela financeiro
CREATE TABLE public.financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao TEXT NOT NULL,
  produto_id UUID,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  quantidade INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES public.products(id) ON DELETE SET NULL
);

-- Habilitar RLS
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- Policies para a tabela financeiro
CREATE POLICY "Usuários podem ver movimentações da sua organização"
  ON public.financeiro
  FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operadores podem inserir movimentações na sua organização"
  ON public.financeiro
  FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid()) 
    AND user_id = auth.uid()
    AND (
      has_role(auth.uid(), 'operador'::app_role) OR
      has_role(auth.uid(), 'almoxarife'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

CREATE POLICY "Admins podem atualizar movimentações da sua organização"
  ON public.financeiro
  FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

CREATE POLICY "Admins podem deletar movimentações da sua organização"
  ON public.financeiro
  FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'superadmin'::app_role)
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para setar organization_id automaticamente
CREATE TRIGGER set_financeiro_organization
  BEFORE INSERT ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_organization();

-- Índices para melhorar performance
CREATE INDEX idx_financeiro_organization ON public.financeiro(organization_id);
CREATE INDEX idx_financeiro_tipo ON public.financeiro(tipo);
CREATE INDEX idx_financeiro_data ON public.financeiro(data DESC);
CREATE INDEX idx_financeiro_produto ON public.financeiro(produto_id);