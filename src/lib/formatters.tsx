import { Badge } from "@/components/ui/badge";

/**
 * Format currency to Brazilian Real
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

/**
 * Format number to Brazilian locale
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat("pt-BR").format(value);
};

/**
 * Get stock status badge based on quantity and minimum quantity
 */
export const getStockBadge = (quantity: number, minQuantity: number) => {
  if (quantity === 0) {
    return <Badge className="bg-danger text-white">Sem Estoque</Badge>;
  } else if (quantity <= minQuantity) {
    return <Badge className="bg-warning text-white">Crítico</Badge>;
  } else {
    return <Badge className="bg-success text-white">Normal</Badge>;
  }
};

/**
 * Get movement type badge
 */
export const getMovementTypeBadge = (type: string) => {
  switch (type) {
    case "IN":
      return <Badge className="bg-success text-white">Entrada</Badge>;
    case "OUT":
      return <Badge className="bg-danger text-white">Saída</Badge>;
    case "TRANSFER":
      return <Badge className="bg-primary text-white">Transferência</Badge>;
    default:
      return <Badge>{type}</Badge>;
  }
};
