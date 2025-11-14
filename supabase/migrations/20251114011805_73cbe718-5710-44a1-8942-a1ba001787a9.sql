-- Drop existing update policy for movements
DROP POLICY IF EXISTS "Superadmins can update movements in their organization" ON public.movements;

-- Create new policy allowing operador and above to update movements
CREATE POLICY "Operadores and above can update movements in their organization"
ON public.movements
FOR UPDATE
USING (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND (
    has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'almoxarife'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'superadmin'::app_role)
  )
)
WITH CHECK (
  (organization_id = get_user_organization_id(auth.uid())) 
  AND (
    has_role(auth.uid(), 'operador'::app_role) 
    OR has_role(auth.uid(), 'almoxarife'::app_role) 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'superadmin'::app_role)
  )
);