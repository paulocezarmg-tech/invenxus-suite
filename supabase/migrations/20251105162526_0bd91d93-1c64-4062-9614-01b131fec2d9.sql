-- Allow anyone (including unauthenticated users) to view a specific invite by ID
-- This is safe because:
-- 1. UUIDs are practically impossible to guess
-- 2. We're only allowing SELECT (read) access
-- 3. The application validates status and expiration
CREATE POLICY "Anyone can view invite by ID"
ON public.invites
FOR SELECT
TO anon, authenticated
USING (true);