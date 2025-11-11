-- Create contas table
CREATE TABLE IF NOT EXISTS public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('Pagar', 'Receber')),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Atrasado')),
  data_pagamento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver contas da sua organização"
ON public.contas
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Operadores podem inserir contas na sua organização"
ON public.contas
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) 
  AND user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'operador'::app_role) 
    OR public.has_role(auth.uid(), 'almoxarife'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

CREATE POLICY "Operadores podem atualizar contas da sua organização"
ON public.contas
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'operador'::app_role) 
    OR public.has_role(auth.uid(), 'almoxarife'::app_role) 
    OR public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

CREATE POLICY "Apenas admins podem deletar contas"
ON public.contas
FOR DELETE
TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  )
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_contas_updated_at
BEFORE UPDATE ON public.contas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to set organization_id automatically
CREATE TRIGGER set_contas_organization
BEFORE INSERT ON public.contas
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_organization();

-- Function to auto-update status based on due date
CREATE OR REPLACE FUNCTION public.update_contas_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contas
  SET status = 'Atrasado'
  WHERE data_vencimento < CURRENT_DATE
  AND status = 'Pendente';
END;
$$;