-- Criar tabela de configurações de relatórios
CREATE TABLE public.relatorio_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  incluir_financeiro BOOLEAN NOT NULL DEFAULT true,
  incluir_estoque_critico BOOLEAN NOT NULL DEFAULT true,
  incluir_previsoes BOOLEAN NOT NULL DEFAULT true,
  incluir_valor_estoque BOOLEAN NOT NULL DEFAULT true,
  horario_envio TIME NOT NULL DEFAULT '08:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.relatorio_configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias configurações"
  ON public.relatorio_configuracoes
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem inserir suas próprias configurações"
  ON public.relatorio_configuracoes
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Usuários podem atualizar suas próprias configurações"
  ON public.relatorio_configuracoes
  FOR UPDATE
  USING (user_id = auth.uid());

-- Admins podem ver configurações da organização
CREATE POLICY "Admins podem ver configurações da organização"
  ON public.relatorio_configuracoes
  FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_relatorio_configuracoes_updated_at
  BEFORE UPDATE ON public.relatorio_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhorar performance
CREATE INDEX idx_relatorio_config_org_user ON public.relatorio_configuracoes(organization_id, user_id);