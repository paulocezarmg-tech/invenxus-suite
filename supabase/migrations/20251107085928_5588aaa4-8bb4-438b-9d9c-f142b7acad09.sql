-- Ensure stock updates on INSERT/UPDATE/DELETE of movements
-- Drop and recreate triggers idempotently
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON public.movements;
DROP TRIGGER IF EXISTS process_kit_movement_trigger ON public.movements;

CREATE TRIGGER update_product_quantity_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_quantity();

CREATE TRIGGER process_kit_movement_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.process_kit_movement();