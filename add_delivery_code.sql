-- Add delivery_code field to shipments table
-- This field stores the QR code for final delivery confirmation

ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS delivery_code TEXT;

-- Generate delivery_code for existing accepted shipments
UPDATE shipments 
SET delivery_code = id::text 
WHERE status IN ('accepted', 'in_transit', 'delivered') 
AND delivery_code IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_code ON shipments(delivery_code);

-- Add trigger to auto-generate delivery_code when status changes to accepted
CREATE OR REPLACE FUNCTION generate_delivery_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('accepted', 'in_transit') AND (NEW.delivery_code IS NULL OR NEW.delivery_code = '') THEN
    NEW.delivery_code := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_delivery_code ON shipments;
CREATE TRIGGER trigger_generate_delivery_code
  BEFORE INSERT OR UPDATE ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_code();

