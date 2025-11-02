-- Criar trigger para processar movimentações de kits
CREATE OR REPLACE TRIGGER process_kit_movement_trigger
  AFTER INSERT ON public.movements
  FOR EACH ROW
  WHEN (NEW.kit_id IS NOT NULL)
  EXECUTE FUNCTION public.process_kit_movement();

-- Criar trigger para processar movimentações de produtos individuais  
CREATE OR REPLACE TRIGGER process_product_movement_trigger
  AFTER INSERT ON public.movements
  FOR EACH ROW
  WHEN (NEW.product_id IS NOT NULL AND NEW.kit_id IS NULL)
  EXECUTE FUNCTION public.update_product_quantity();