-- Create plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_companies INTEGER NOT NULL DEFAULT 1,
  max_products INTEGER NOT NULL DEFAULT 100,
  max_movements INTEGER NOT NULL DEFAULT 1000,
  ai_features JSONB DEFAULT '{"enabled": false, "monthly_limit": 0}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  renewal_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  trial_end_date DATE,
  payment_status TEXT DEFAULT 'pending',
  last_payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plans
CREATE POLICY "Plans are viewable by everyone"
  ON public.plans FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage plans"
  ON public.plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their organization subscription"
  ON public.subscriptions FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans
INSERT INTO public.plans (name, price, description, max_users, max_companies, max_products, max_movements, ai_features, status) VALUES
('Gratuito', 0, 'Plano básico para começar', 1, 1, 50, 500, '{"enabled": false, "monthly_limit": 0}'::jsonb, 'active'),
('Essencial', 49.90, 'Para pequenas empresas', 5, 1, 500, 5000, '{"enabled": true, "monthly_limit": 50}'::jsonb, 'active'),
('Profissional', 99.90, 'Para empresas em crescimento', 15, 3, 2000, 20000, '{"enabled": true, "monthly_limit": 200}'::jsonb, 'active'),
('Empresarial', 199.90, 'Solução completa', 50, 10, 10000, 100000, '{"enabled": true, "monthly_limit": 1000}'::jsonb, 'active');