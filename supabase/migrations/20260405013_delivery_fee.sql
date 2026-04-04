-- Cost livrare pentru comenzi (ex. magazin asociație), lei — o singură linie din batch poate purta taxa.

ALTER TABLE public.comenzi
  ADD COLUMN IF NOT EXISTS cost_livrare numeric(10, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.comenzi.cost_livrare IS 'Cost livrare (RON) pentru linie; 0 dacă nu se aplică pe această linie.';
