-- Consimțământ contact WhatsApp pentru comenzi magazin (OUG / comunicări comerciale)
ALTER TABLE public.comenzi ADD COLUMN IF NOT EXISTS whatsapp_consent boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.comenzi.whatsapp_consent IS 'Consimțământ explicit pentru contact pe WhatsApp la numărul indicat (magazin public).';
