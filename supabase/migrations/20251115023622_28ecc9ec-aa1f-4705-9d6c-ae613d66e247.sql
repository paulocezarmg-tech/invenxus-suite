-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  related_entity_id uuid,
  related_entity_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view notifications from their organization
CREATE POLICY "Users can view notifications from their organization"
ON public.notifications
FOR SELECT
USING (organization_id = get_user_organization_id(auth.uid()));

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (organization_id = get_user_organization_id(auth.uid()) AND user_id = auth.uid());

-- System can create notifications
CREATE POLICY "System can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create function to notify admins about low stock
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Check if product is now at or below minimum quantity
  IF NEW.quantity <= NEW.min_quantity THEN
    -- Get all admins and almoxarifes from the organization
    FOR admin_record IN 
      SELECT DISTINCT om.user_id
      FROM public.organization_members om
      INNER JOIN public.user_roles ur ON ur.user_id = om.user_id
      WHERE om.organization_id = NEW.organization_id
        AND ur.role IN ('admin', 'superadmin', 'almoxarife')
    LOOP
      -- Create notification for each admin/almoxarife
      INSERT INTO public.notifications (
        organization_id,
        user_id,
        title,
        message,
        type,
        related_entity_id,
        related_entity_type
      ) VALUES (
        NEW.organization_id,
        admin_record.user_id,
        'Estoque Baixo',
        'O produto "' || NEW.name || '" está com estoque baixo (' || NEW.quantity || ' unidades)',
        'warning',
        NEW.id,
        'product'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on products table
DROP TRIGGER IF EXISTS trigger_notify_low_stock ON public.products;
CREATE TRIGGER trigger_notify_low_stock
  AFTER INSERT OR UPDATE OF quantity
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();