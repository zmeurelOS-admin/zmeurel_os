-- Add 'interval_tratament_zile' column to culturi table
-- Used for dashboard alerts about treatment intervals

ALTER TABLE culturi 
ADD COLUMN interval_tratament_zile INTEGER DEFAULT 14;

-- Add comment for documentation
COMMENT ON COLUMN culturi.interval_tratament_zile IS 'Număr maxim de zile recomandat între tratamente. Folosit pentru alerte dashboard.';
