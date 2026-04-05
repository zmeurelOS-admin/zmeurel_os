-- Admin association order/product extensions.

ALTER TABLE public.comenzi
  ADD COLUMN IF NOT EXISTS note_interne text;

COMMENT ON COLUMN public.comenzi.note_interne IS 'Note vizibile doar echipei asociației pentru comenzile din magazin.';

ALTER TABLE public.produse
  ADD COLUMN IF NOT EXISTS assoc_ingrediente text,
  ADD COLUMN IF NOT EXISTS assoc_alergeni text,
  ADD COLUMN IF NOT EXISTS assoc_pastrare text,
  ADD COLUMN IF NOT EXISTS assoc_valabilitate text,
  ADD COLUMN IF NOT EXISTS assoc_tip_produs text
    CHECK (assoc_tip_produs IN ('standard', 'bio', 'traditional', 'ecologic'));

COMMENT ON COLUMN public.produse.assoc_ingrediente IS 'Override magazin asociație pentru ingrediente.';
COMMENT ON COLUMN public.produse.assoc_alergeni IS 'Override magazin asociație pentru alergeni.';
COMMENT ON COLUMN public.produse.assoc_pastrare IS 'Override magazin asociație pentru condiții de păstrare.';
COMMENT ON COLUMN public.produse.assoc_valabilitate IS 'Override magazin asociație pentru termen de valabilitate.';
COMMENT ON COLUMN public.produse.assoc_tip_produs IS 'Tip produs setat de asociație pentru vitrina publică.';
