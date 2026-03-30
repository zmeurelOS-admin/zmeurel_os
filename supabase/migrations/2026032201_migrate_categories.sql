-- Migrare categorii legacy → categorii canonice
-- Sigur: folosește WHERE exacte, nu afectează rânduri fără categorie sau cu categorii deja corecte.

-- ─── cheltuieli_diverse ───────────────────────────────────────────────────────

UPDATE cheltuieli_diverse SET categorie = 'Combustibil și energie'
  WHERE categorie IN ('Electricitate', 'Motorina Transport');

UPDATE cheltuieli_diverse SET categorie = 'Ambalaje'
  WHERE categorie = 'Etichete';

UPDATE cheltuieli_diverse SET categorie = 'Reparații și întreținere'
  WHERE categorie IN ('Reparatii Utilaje', 'Intretinere Curenta');

UPDATE cheltuieli_diverse SET categorie = 'Consumabile'
  WHERE categorie = 'Scule';

UPDATE cheltuieli_diverse SET categorie = 'Fertilizanți'
  WHERE categorie = 'Fertilizare';

UPDATE cheltuieli_diverse SET categorie = 'Tratamente fitosanitare'
  WHERE categorie = 'Pesticide';

UPDATE cheltuieli_diverse SET categorie = 'Forță de muncă'
  WHERE categorie IN ('Cules', 'Manoperă cules');

-- Material Saditor / Sistem Sustinere / Sistem Irigatie erau greșit categorisite ca cheltuieli;
-- le mutăm în Diverse operaționale (nu putem ști retroactiv dacă erau CAPEX sau OPEX).
UPDATE cheltuieli_diverse SET categorie = 'Diverse operaționale'
  WHERE categorie IN ('Material Saditor', 'Sistem Sustinere', 'Sistem Irigatie', 'Altele');

-- ─── investitii ───────────────────────────────────────────────────────────────

UPDATE investitii SET categorie = 'Material săditor'
  WHERE categorie = 'Butași';

UPDATE investitii SET categorie = 'Irigații și fertigare'
  WHERE categorie = 'Sistem Irigație';

UPDATE investitii SET categorie = 'Sisteme de susținere și protecție'
  WHERE categorie = 'Solar / Tunel';

UPDATE investitii SET categorie = 'Utilaje și echipamente'
  WHERE categorie = 'Utilaje';

UPDATE investitii SET categorie = 'Depozitare și răcire'
  WHERE categorie = 'Depozitare';

-- Ambalaje nu este o investiție — mapăm la Alte investiții
UPDATE investitii SET categorie = 'Alte investiții'
  WHERE categorie IN ('Ambalaje', 'Altele');

NOTIFY pgrst, 'reload schema';
