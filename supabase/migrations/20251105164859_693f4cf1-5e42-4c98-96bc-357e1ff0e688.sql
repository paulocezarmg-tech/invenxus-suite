-- Allow anyone (including unauthenticated users) to update invite status to 'accepted'
-- This is needed when a user accepts an invite before being authenticated
CREATE POLICY "Anyone can accept invites"
ON public.invites
FOR UPDATE
TO anon, authenticated
USING (status = 'pending')
WITH CHECK (status = 'accepted');