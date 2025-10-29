-- Create enum for invite status
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- Create invites table
CREATE TABLE public.invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operador'::app_role,
  status invite_status NOT NULL DEFAULT 'pending'::invite_status,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(email, status)
);

-- Enable RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admins can view all invites
CREATE POLICY "Admins can view all invites"
ON public.invites
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Admins can create invites
CREATE POLICY "Admins can create invites"
ON public.invites
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Admins can update invites (cancel, etc)
CREATE POLICY "Admins can update invites"
ON public.invites
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Admins can delete invites
CREATE POLICY "Admins can delete invites"
ON public.invites
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Create trigger to update updated_at
CREATE TRIGGER update_invites_updated_at
BEFORE UPDATE ON public.invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();