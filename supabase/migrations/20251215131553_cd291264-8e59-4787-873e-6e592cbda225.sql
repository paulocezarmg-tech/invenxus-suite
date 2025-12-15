-- Add categoria column to financeiro table
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'Operacional';

-- Create metas_financeiras table
CREATE TABLE IF NOT EXISTS public.metas_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('faturamento', 'lucro', 'margem', 'vendas')),
  valor_meta NUMERIC NOT NULL,
  periodo TEXT NOT NULL CHECK (periodo IN ('mensal', 'trimestral', 'anual')),
  mes INTEGER,
  ano INTEGER NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.metas_financeiras ENABLE ROW LEVEL SECURITY;

-- Create policies for metas_financeiras
CREATE POLICY "Users can view metas from their organization"
ON public.metas_financeiras
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert metas in their organization"
ON public.metas_financeiras
FOR INSERT
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid()) 
  AND user_id = auth.uid()
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can update metas in their organization"
ON public.metas_financeiras
FOR UPDATE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can delete metas in their organization"
ON public.metas_financeiras
FOR DELETE
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

-- Create trigger for updated_at
CREATE TRIGGER update_metas_financeiras_updated_at
BEFORE UPDATE ON public.metas_financeiras
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();