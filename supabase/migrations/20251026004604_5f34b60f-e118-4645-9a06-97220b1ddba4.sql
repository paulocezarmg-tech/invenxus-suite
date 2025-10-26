-- Fix search_path for get_critical_products function
CREATE OR REPLACE FUNCTION public.get_critical_products()
RETURNS TABLE (
  id UUID,
  sku TEXT,
  barcode TEXT,
  name TEXT,
  description TEXT,
  category_id UUID,
  unit TEXT,
  cost DECIMAL,
  quantity DECIMAL,
  min_quantity DECIMAL,
  location_id UUID,
  supplier_id UUID,
  image_url TEXT,
  active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  category_name TEXT,
  location_name TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.sku,
    p.barcode,
    p.name,
    p.description,
    p.category_id,
    p.unit,
    p.cost,
    p.quantity,
    p.min_quantity,
    p.location_id,
    p.supplier_id,
    p.image_url,
    p.active,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    l.name as location_name
  FROM public.products p
  LEFT JOIN public.categories c ON p.category_id = c.id
  LEFT JOIN public.locations l ON p.location_id = l.id
  WHERE p.quantity <= p.min_quantity
  ORDER BY p.quantity ASC
  LIMIT 10
$$;