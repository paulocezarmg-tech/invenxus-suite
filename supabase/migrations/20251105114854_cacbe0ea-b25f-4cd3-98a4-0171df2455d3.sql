-- Fix critical privilege escalation: Change default role from 'admin' to 'operador'
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador'::app_role);
  RETURN NEW;
END;
$function$;