-- Update the update_product_quantity function to handle DELETE
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Handle DELETE: Reverse the movement
  IF TG_OP = 'DELETE' THEN
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
    RETURN OLD;
  END IF;

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
$function$;

-- Update the process_kit_movement function to handle DELETE
CREATE OR REPLACE FUNCTION public.process_kit_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
BEGIN
  -- Handle DELETE: Reverse the kit movement
  IF TG_OP = 'DELETE' THEN
    IF OLD.kit_id IS NOT NULL AND (OLD.type = 'OUT' OR OLD.type = 'IN') THEN
      FOR item IN 
        SELECT product_id, quantity 
        FROM public.kit_items 
        WHERE kit_id = OLD.kit_id
      LOOP
        IF OLD.type = 'OUT' THEN
          -- Reverse OUT: add products back
          UPDATE public.products
          SET quantity = quantity + (item.quantity * OLD.quantity)
          WHERE id = item.product_id;
        ELSIF OLD.type = 'IN' THEN
          -- Reverse IN: remove products
          UPDATE public.products
          SET quantity = quantity - (item.quantity * OLD.quantity)
          WHERE id = item.product_id;
        END IF;
      END LOOP;
    END IF;
    RETURN OLD;
  END IF;

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
$function$;

-- Drop existing triggers
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON public.movements;
DROP TRIGGER IF EXISTS process_kit_movement_trigger ON public.movements;

-- Create triggers that handle INSERT, UPDATE, and DELETE
CREATE TRIGGER update_product_quantity_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_quantity();

CREATE TRIGGER process_kit_movement_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.movements
  FOR EACH ROW
  EXECUTE FUNCTION public.process_kit_movement();