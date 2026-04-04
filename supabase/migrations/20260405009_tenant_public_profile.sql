-- Profil public opțional pentru vitrina asociației (pagină producător).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS descriere_publica text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS poze_ferma text[];
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS localitate text DEFAULT 'Suceava';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS specialitate text;

COMMENT ON COLUMN public.tenants.descriere_publica IS 'Text scurt pentru pagina publică producător (magazin asociație).';
COMMENT ON COLUMN public.tenants.poze_ferma IS 'URL-uri imagini fermă/produse (Storage sau externe).';
COMMENT ON COLUMN public.tenants.localitate IS 'Afișat pe profil public (implicit Suceava).';
COMMENT ON COLUMN public.tenants.specialitate IS 'Ex: Fructe de pădure, Lactate — afișat ca badge pe profil.';

NOTIFY pgrst, 'reload schema';
