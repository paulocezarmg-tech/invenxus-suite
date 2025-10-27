-- Fix RLS policy for products table to include WITH CHECK for INSERT
DROP POLICY IF EXISTS "Almoxarifes and admins can manage products" ON public.products;

CREATE POLICY "Almoxarifes and admins can manage products" 
ON public.products 
FOR ALL 
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

-- Create function to assign default role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'admin'::app_role);
  RETURN NEW;
END;
$$;

-- Create trigger to automatically assign role on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();