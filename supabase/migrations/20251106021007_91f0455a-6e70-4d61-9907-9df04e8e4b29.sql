-- Drop existing triggers that are duplicated or incorrect
DROP TRIGGER IF EXISTS update_product_quantity_on_movement ON public.movements;

-- Recreate the product movement trigger to handle both INSERT and UPDATE
DROP TRIGGER IF EXISTS process_product_movement_trigger ON public.movements;

CREATE TRIGGER process_product_movement_trigger 
AFTER INSERT OR UPDATE ON public.movements 
FOR EACH ROW 
WHEN (NEW.product_id IS NOT NULL AND NEW.kit_id IS NULL)
EXECUTE FUNCTION update_product_quantity();

-- Update the function to handle UPDATE operations correctly
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Handle UPDATE: First reverse the old movement
  IF TG_OP = 'UPDATE' THEN
    IF OLD.type = 'IN' THEN
      UPDATE public.products
      SET quantity = quantity - OLD.quantity
      WHERE id = OLD.product_id;
    ELSIF OLD.type = 'OUT' THEN
      UPDATE public.products
      SET quantity = quantity + OLD.quantity
      WHERE id = OLD.product_id;
    ELSIF OLD.type = 'TRANSFER' THEN
      -- Reverse the transfer (put product back to original location)
      UPDATE public.products
      SET location_id = OLD.from_location_id
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  -- Now apply the new movement (works for both INSERT and UPDATE)
  IF NEW.type = 'IN' THEN
    UPDATE public.products
    SET quantity = quantity + NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.type = 'OUT' THEN
    UPDATE public.products
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.product_id;
  ELSIF NEW.type = 'TRANSFER' THEN
    UPDATE public.products
    SET location_id = NEW.to_location_id
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update kit movement trigger to handle UPDATE as well
DROP TRIGGER IF EXISTS process_kit_movement_trigger ON public.movements;

CREATE TRIGGER process_kit_movement_trigger 
AFTER INSERT OR UPDATE ON public.movements 
FOR EACH ROW 
WHEN (NEW.kit_id IS NOT NULL)
EXECUTE FUNCTION process_kit_movement();

-- Update the kit movement function to handle UPDATE operations
CREATE OR REPLACE FUNCTION public.process_kit_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only process if movement has a kit_id and type is OUT or IN
  IF NEW.kit_id IS NOT NULL AND (NEW.type = 'OUT' OR NEW.type = 'IN') THEN
    
    -- If UPDATE, reverse the old movement first
    IF TG_OP = 'UPDATE' THEN
      FOR item IN 
        SELECT product_id, quantity 
        FROM public.kit_items 
        WHERE kit_id = OLD.kit_id
      LOOP
        IF OLD.type = 'OUT' THEN
          UPDATE public.products
          SET quantity = quantity + (item.quantity * OLD.quantity)
          WHERE id = item.product_id;
        ELSIF OLD.type = 'IN' THEN
          UPDATE public.products
          SET quantity = quantity - (item.quantity * OLD.quantity)
          WHERE id = item.product_id;
        END IF;
      END LOOP;
    END IF;
    
    -- Now apply the new movement
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.kit_items 
      WHERE kit_id = NEW.kit_id
    LOOP
      IF NEW.type = 'OUT' THEN
        UPDATE public.products
        SET quantity = quantity - (item.quantity * NEW.quantity)
        WHERE id = item.product_id;
      ELSIF NEW.type = 'IN' THEN
        UPDATE public.products
        SET quantity = quantity + (item.quantity * NEW.quantity)
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;