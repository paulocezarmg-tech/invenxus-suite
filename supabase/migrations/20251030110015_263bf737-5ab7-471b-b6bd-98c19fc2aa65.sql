-- Create kits table
CREATE TABLE public.kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create kit_items table (junction table for kit composition)
CREATE TABLE public.kit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(kit_id, product_id)
);

-- Enable RLS on kits table
ALTER TABLE public.kits ENABLE ROW LEVEL SECURITY;

-- RLS policies for kits
CREATE POLICY "Kits are viewable by authenticated users"
ON public.kits FOR SELECT
USING (true);

CREATE POLICY "Almoxarifes and admins can manage kits"
ON public.kits FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'almoxarife'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'almoxarife'::app_role)
);

-- Enable RLS on kit_items table
ALTER TABLE public.kit_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for kit_items
CREATE POLICY "Kit items are viewable by authenticated users"
ON public.kit_items FOR SELECT
USING (true);

CREATE POLICY "Almoxarifes and admins can manage kit items"
ON public.kit_items FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'almoxarife'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'superadmin'::app_role) OR 
  has_role(auth.uid(), 'almoxarife'::app_role)
);

-- Add kit_id column to movements table to track kit movements
ALTER TABLE public.movements ADD COLUMN kit_id UUID REFERENCES public.kits(id) ON DELETE SET NULL;

-- Create function to process kit movements
CREATE OR REPLACE FUNCTION public.process_kit_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  item RECORD;
BEGIN
  -- Only process if movement has a kit_id and type is OUT or IN
  IF NEW.kit_id IS NOT NULL AND (NEW.type = 'OUT' OR NEW.type = 'IN') THEN
    -- Loop through all items in the kit
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.kit_items 
      WHERE kit_id = NEW.kit_id
    LOOP
      -- Update product quantity based on movement type
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

-- Create trigger for kit movements
CREATE TRIGGER process_kit_movement_trigger
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.process_kit_movement();

-- Add trigger for updated_at on kits
CREATE TRIGGER update_kits_updated_at
BEFORE UPDATE ON public.kits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();