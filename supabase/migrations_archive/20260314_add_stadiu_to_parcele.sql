-- DEPRECATED: Duplicat idempotent al 2026031402_add_stadiu_to_parcele.sql (format A)
-- Add stadiu (growth stage) column to parcele
-- Values: 'plantare', 'crestere', 'inflorire', 'cules', 'repaus'
-- Only parcele with stadiu = 'cules' trigger the "nerecoltat azi" alert

alter table public.parcele
  add column if not exists stadiu text not null default 'crestere';

notify pgrst, 'reload schema';
