-- 1. Coloane noi pentru snapshot client si canal confirmare
ALTER TABLE comenzi
  ADD COLUMN IF NOT EXISTS canal_confirmare TEXT CHECK (canal_confirmare IN ('whatsapp', 'sms', 'apel')),
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN comenzi.canal_confirmare IS 'canalul ales de client pentru aceasta comanda';
COMMENT ON COLUMN comenzi.customer_snapshot IS 'freeze al datelor clientului la momentul comenzii';

-- 2. Dovada opt-in-ului pentru WhatsApp / SMS
CREATE TABLE IF NOT EXISTS consent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'sms')),
  scope TEXT NOT NULL DEFAULT 'order_updates',
  granted_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  order_id UUID REFERENCES comenzi(id) ON DELETE SET NULL,
  tenant_context TEXT DEFAULT 'association',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_events_phone_canal
  ON consent_events(phone, canal);

ALTER TABLE consent_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin can read consent_events"
  ON consent_events
  FOR SELECT
  USING (public.is_superadmin());

-- 3. Log mesaje pentru viitoare integrari WhatsApp / SMS / apel
CREATE TABLE IF NOT EXISTS message_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES comenzi(id) ON DELETE SET NULL,
  canal TEXT NOT NULL CHECK (canal IN ('whatsapp', 'sms', 'apel')),
  tip_mesaj TEXT NOT NULL CHECK (tip_mesaj IN ('confirmare', 'actualizare', 'rezumat', 'manual')),
  destinatar_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  provider TEXT,
  provider_message_id TEXT,
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_log_order
  ON message_log(order_id);

CREATE INDEX IF NOT EXISTS idx_message_log_status
  ON message_log(status);

ALTER TABLE message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin can read message_log"
  ON message_log
  FOR SELECT
  USING (public.is_superadmin());
