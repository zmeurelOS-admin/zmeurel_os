-- Add 'rol' column to parcele table
-- Values: 'comercial' (default), 'uz_propriu'
-- CHECK constraint ensures only valid values

ALTER TABLE parcele 
ADD COLUMN rol TEXT NOT NULL DEFAULT 'comercial';

-- Add CHECK constraint for valid role values
ALTER TABLE parcele 
ADD CONSTRAINT parcele_rol_check 
CHECK (rol IN ('comercial', 'uz_propriu'));

-- Add comment for documentation
COMMENT ON COLUMN parcele.rol IS 'Rolul parcelei: comercial sau uz_propriu';
