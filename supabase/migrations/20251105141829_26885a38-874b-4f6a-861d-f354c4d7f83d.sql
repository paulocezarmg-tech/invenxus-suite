-- Add updated_at column to invites table
ALTER TABLE public.invites 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();