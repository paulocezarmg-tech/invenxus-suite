-- Drop the restrictive policy for viewing notifications
DROP POLICY IF EXISTS "Users can view notifications from their organization" ON public.notifications;

-- Create a simpler policy that allows users to view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());