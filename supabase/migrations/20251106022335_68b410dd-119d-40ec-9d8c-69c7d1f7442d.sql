-- 1) Remove automatic initial movement trigger and function
DROP TRIGGER IF EXISTS create_initial_movement_trigger ON public.products;
DROP FUNCTION IF EXISTS public.create_initial_movement();

-- 2) Delete retroactive/automatic initial movements we previously created
DELETE FROM public.movements
WHERE reference IN ('Estoque inicial', 'Estoque inicial (retroativo)')
  AND (note ILIKE 'Entrada automática%' OR note IS NULL);

-- 3) Recalculate product quantities strictly from movement history (IN - OUT)
-- 3a) Update products that have movements
UPDATE public.products p
SET quantity = COALESCE(m.sum_qty, 0)
FROM (
  SELECT product_id,
         SUM(CASE WHEN type = 'IN' THEN quantity
                  WHEN type = 'OUT' THEN -quantity
                  ELSE 0 END) AS sum_qty
  FROM public.movements
  WHERE product_id IS NOT NULL
  GROUP BY product_id
) m
WHERE p.id = m.product_id;

-- 3b) Set products with no movements to zero
UPDATE public.products p
SET quantity = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.movements m WHERE m.product_id = p.id
);
