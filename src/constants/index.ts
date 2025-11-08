export const ROLE_HIERARCHY = {
  superadmin: 4,
  admin: 3,
  almoxarife: 2,
  auditor: 1,
  operador: 0,
} as const;

export const PRODUCT_UNITS = [
  { value: "UN", label: "Unidade" },
  { value: "KG", label: "Quilograma" },
  { value: "L", label: "Litro" },
  { value: "M", label: "Metro" },
  { value: "CX", label: "Caixa" },
] as const;

export const MOVEMENT_TYPES = [
  { value: "IN", label: "Entrada" },
  { value: "OUT", label: "Saída" },
  { value: "TRANSFER", label: "Transferência" },
] as const;

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  almoxarife: "Almoxarife",
  auditor: "Auditor",
  operador: "Operador",
};
