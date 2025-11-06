-- Create trigger function to automatically create IN movement when product is created with initial quantity
CREATE OR REPLACE FUNCTION public.create_initial_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create movement if product has initial quantity > 0
  IF NEW.quantity > 0 AND TG_OP = 'INSERT' THEN
    INSERT INTO public.movements (
      type,
      product_id,
      quantity,
      reference,
      note,
      created_by,
      organization_id
    )
    VALUES (
      'IN',
      NEW.id,
      NEW.quantity,
      'Estoque inicial',
      'Entrada automática de estoque inicial do produto',
      auth.uid(),
      NEW.organization_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on products table
DROP TRIGGER IF EXISTS create_initial_movement_trigger ON public.products;

CREATE TRIGGER create_initial_movement_trigger
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION create_initial_movement();

-- Create initial movements for existing products that don't have any movements yet
-- This will create retroactive IN movements for products with quantity but no movement history
INSERT INTO public.movements (
  type,
  product_id,
  quantity,
  reference,
  note,
  created_by,
  organization_id,
  created_at
)
SELECT 
  'IN',
  p.id,
  p.quantity,
  'Estoque inicial (retroativo)',
  'Entrada automática criada para produtos existentes sem histórico de movimentação',
  (SELECT user_id FROM public.organization_members WHERE organization_id = p.organization_id LIMIT 1),
  p.organization_id,
  p.created_at
FROM public.products p
WHERE p.quantity > 0
  AND NOT EXISTS (
    SELECT 1 
    FROM public.movements m 
    WHERE m.product_id = p.id
  );