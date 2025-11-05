-- Adicionar índices para otimizar performance das queries

-- Índices para a tabela products
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_location_id ON public.products(location_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);

-- Índices para a tabela movements
CREATE INDEX IF NOT EXISTS idx_movements_organization_id ON public.movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON public.movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type ON public.movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON public.movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_created_by ON public.movements(created_by);
CREATE INDEX IF NOT EXISTS idx_movements_kit_id ON public.movements(kit_id);

-- Índices para a tabela kits
CREATE INDEX IF NOT EXISTS idx_kits_organization_id ON public.kits(organization_id);
CREATE INDEX IF NOT EXISTS idx_kits_name ON public.kits(name);
CREATE INDEX IF NOT EXISTS idx_kits_sku ON public.kits(sku);

-- Índices para a tabela kit_items
CREATE INDEX IF NOT EXISTS idx_kit_items_kit_id ON public.kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_kit_items_product_id ON public.kit_items(product_id);

-- Índices para a tabela user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Índices para a tabela invites
CREATE INDEX IF NOT EXISTS idx_invites_organization_id ON public.invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_status ON public.invites(status);

-- Índices para a tabela categories
CREATE INDEX IF NOT EXISTS idx_categories_organization_id ON public.categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON public.categories(name);

-- Índices para a tabela suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_organization_id ON public.suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

-- Índices para a tabela locations
CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON public.locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_code ON public.locations(code);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_products_org_category ON public.products(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_movements_org_created ON public.movements(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_org_active ON public.products(organization_id, active);