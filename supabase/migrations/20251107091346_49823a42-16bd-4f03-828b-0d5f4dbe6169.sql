-- Drop duplicate trigger that was double-applying quantity updates
DROP TRIGGER IF EXISTS process_product_movement_trigger ON public.movements;

-- Ensure the correct trigger exists exactly once (BEFORE INSERT/UPDATE/DELETE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_proc p ON p.oid = tg.tgfoid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'movements'
      AND tg.tgname = 'update_product_quantity_trigger'
  ) THEN
    CREATE TRIGGER update_product_quantity_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON public.movements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_product_quantity();
  END IF;
END $$;