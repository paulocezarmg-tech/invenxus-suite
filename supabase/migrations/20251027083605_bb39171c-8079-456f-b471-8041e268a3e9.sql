-- Add UPDATE and DELETE policies for movements table (only for superadmin)
CREATE POLICY "Superadmins can update movements" 
ON public.movements 
FOR UPDATE 
USING (has_role(auth.uid(), 'superadmin'::app_role))
WITH CHECK (has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins can delete movements" 
ON public.movements 
FOR DELETE 
USING (has_role(auth.uid(), 'superadmin'::app_role));