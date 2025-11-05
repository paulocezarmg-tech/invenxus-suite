-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_members table (links users to organizations)
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Create security definer function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM public.organization_members 
  WHERE user_id = _user_id 
  LIMIT 1
$$;

-- Add organization_id to all data tables
ALTER TABLE public.products ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.locations ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.kits ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.movements ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invites ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create default organization and migrate existing data
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default organization
  INSERT INTO public.organizations (name, slug)
  VALUES ('Organização Padrão', 'default')
  RETURNING id INTO default_org_id;
  
  -- Migrate all existing users to default organization
  INSERT INTO public.organization_members (organization_id, user_id)
  SELECT default_org_id, id FROM auth.users;
  
  -- Update all existing data with default organization
  UPDATE public.products SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.categories SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.locations SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.suppliers SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.kits SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.movements SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.invites SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE public.profiles SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;

-- Make organization_id NOT NULL after migration
ALTER TABLE public.products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.locations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.kits ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.movements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.invites ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_products_organization ON public.products(organization_id);
CREATE INDEX idx_categories_organization ON public.categories(organization_id);
CREATE INDEX idx_locations_organization ON public.locations(organization_id);
CREATE INDEX idx_suppliers_organization ON public.suppliers(organization_id);
CREATE INDEX idx_kits_organization ON public.kits(organization_id);
CREATE INDEX idx_movements_organization ON public.movements(organization_id);
CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);

-- RLS Policies for organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Superadmins can manage organizations"
ON public.organizations FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- RLS Policies for organization_members
CREATE POLICY "Users can view their own membership"
ON public.organization_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Superadmins can manage memberships"
ON public.organization_members FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Update RLS policies for products
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;
DROP POLICY IF EXISTS "Almoxarifes and admins can manage products" ON public.products;

CREATE POLICY "Users can view products from their organization"
ON public.products FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Almoxarifes and admins can manage products in their organization"
ON public.products FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role))
);

-- Update RLS policies for categories
DROP POLICY IF EXISTS "Categories are viewable by authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Users can view categories from their organization"
ON public.categories FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage categories in their organization"
ON public.categories FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

-- Update RLS policies for locations
DROP POLICY IF EXISTS "Locations are viewable by authenticated users" ON public.locations;
DROP POLICY IF EXISTS "Admins can manage locations" ON public.locations;

CREATE POLICY "Users can view locations from their organization"
ON public.locations FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage locations in their organization"
ON public.locations FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

-- Update RLS policies for suppliers
DROP POLICY IF EXISTS "Suppliers are viewable by authenticated users" ON public.suppliers;
DROP POLICY IF EXISTS "Admins and almoxarifes can manage suppliers" ON public.suppliers;

CREATE POLICY "Users can view suppliers from their organization"
ON public.suppliers FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins and almoxarifes can manage suppliers in their organization"
ON public.suppliers FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role))
);

-- Update RLS policies for kits
DROP POLICY IF EXISTS "Kits are viewable by authenticated users" ON public.kits;
DROP POLICY IF EXISTS "Almoxarifes and admins can manage kits" ON public.kits;

CREATE POLICY "Users can view kits from their organization"
ON public.kits FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Almoxarifes and admins can manage kits in their organization"
ON public.kits FOR ALL
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role))
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role))
);

-- Update RLS policies for movements
DROP POLICY IF EXISTS "Movements are viewable by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Operadores and above can create movements" ON public.movements;
DROP POLICY IF EXISTS "Superadmins can update movements" ON public.movements;
DROP POLICY IF EXISTS "Superadmins can delete movements" ON public.movements;

CREATE POLICY "Users can view movements from their organization"
ON public.movements FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Operadores and above can create movements in their organization"
ON public.movements FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'almoxarife'::app_role) OR 
   has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Superadmins can update movements in their organization"
ON public.movements FOR UPDATE
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  has_role(auth.uid(), 'superadmin'::app_role)
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  has_role(auth.uid(), 'superadmin'::app_role)
);

CREATE POLICY "Superadmins can delete movements in their organization"
ON public.movements FOR DELETE
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  has_role(auth.uid(), 'superadmin'::app_role)
);

-- Update RLS policies for invites
DROP POLICY IF EXISTS "Admins can view all invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can update invites" ON public.invites;
DROP POLICY IF EXISTS "Admins can delete invites" ON public.invites;
DROP POLICY IF EXISTS "Anyone can view invite by ID" ON public.invites;
DROP POLICY IF EXISTS "Anyone can accept invites" ON public.invites;

CREATE POLICY "Admins can view invites from their organization"
ON public.invites FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can create invites for their organization"
ON public.invites FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can update invites in their organization"
ON public.invites FOR UPDATE
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Admins can delete invites in their organization"
ON public.invites FOR DELETE
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Anyone can view invite by ID for acceptance"
ON public.invites FOR SELECT
USING (true);

CREATE POLICY "Anyone can accept pending invites"
ON public.invites FOR UPDATE
USING (status = 'pending'::invite_status)
WITH CHECK (status = 'accepted'::invite_status);

-- Update RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view profiles in their organization"
ON public.profiles FOR SELECT
USING (
  organization_id = public.get_user_organization_id(auth.uid()) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Create trigger to auto-assign organization on new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_org_id UUID;
BEGIN
  -- Get user's organization
  user_org_id := public.get_user_organization_id(NEW.user_id);
  
  -- Set organization_id if not already set
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := user_org_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to profiles table
CREATE TRIGGER set_profile_organization
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_organization();

-- Update updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();