-- Adicionar campos para integração com Mercado Pago
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS preapproval_id TEXT,
ADD COLUMN IF NOT EXISTS mp_status TEXT;

-- Criar índice para busca rápida por preapproval_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_preapproval_id ON subscriptions(preapproval_id);

-- Adicionar campo opcional para armazenar price_id do Mercado Pago nos planos
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS mp_preapproval_template_id TEXT;

-- Criar tabela para histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  preapproval_id TEXT NOT NULL,
  payment_id TEXT,
  status TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- RLS policies para payment_history
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization payment history"
  ON payment_history FOR SELECT
  USING (
    subscription_id IN (
      SELECT id FROM subscriptions 
      WHERE organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "System can insert payment history"
  ON payment_history FOR INSERT
  WITH CHECK (true);

-- Criar índice para busca de histórico
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_preapproval ON payment_history(preapproval_id);