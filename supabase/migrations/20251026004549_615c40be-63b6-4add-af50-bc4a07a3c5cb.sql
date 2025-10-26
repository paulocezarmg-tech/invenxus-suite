-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix search_path for update_product_quantity function
CREATE OR REPLACE FUNCTION public.update_product_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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