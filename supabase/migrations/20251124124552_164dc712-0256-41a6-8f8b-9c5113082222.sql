-- Add CNPJ column to suppliers table
ALTER TABLE public.suppliers 
ADD COLUMN cnpj TEXT UNIQUE;

-- Add index for better CNPJ lookup performance
CREATE INDEX idx_suppliers_cnpj ON public.suppliers(cnpj) WHERE cnpj IS NOT NULL;