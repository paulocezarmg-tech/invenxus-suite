/**
 * Validates a Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica)
 */
export const validateCNPJ = (cnpj: string): boolean => {
  // Remove non-numeric characters
  const cleaned = cnpj.replace(/\D/g, "");
  
  // Check if it has 14 digits
  if (cleaned.length !== 14) return false;
  
  // Check for known invalid CNPJs
  if (/^(\d)\1+$/.test(cleaned)) return false;
  
  // Validate first check digit
  let sum = 0;
  let weight = 5;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cleaned.charAt(12)) !== digit) return false;
  
  // Validate second check digit
  sum = 0;
  weight = 6;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weight;
    weight = weight === 2 ? 9 : weight - 1;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (parseInt(cleaned.charAt(13)) !== digit) return false;
  
  return true;
};

/**
 * Formats a CNPJ string to XX.XXX.XXX/XXXX-XX
 */
export const formatCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};

/**
 * Masks CNPJ input as user types
 */
export const maskCNPJ = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  let masked = cleaned;
  
  if (cleaned.length > 2) {
    masked = cleaned.substring(0, 2) + "." + cleaned.substring(2);
  }
  if (cleaned.length > 5) {
    masked = masked.substring(0, 6) + "." + cleaned.substring(5);
  }
  if (cleaned.length > 8) {
    masked = masked.substring(0, 10) + "/" + cleaned.substring(8);
  }
  if (cleaned.length > 12) {
    masked = masked.substring(0, 15) + "-" + cleaned.substring(12, 14);
  }
  
  return masked.substring(0, 18); // XX.XXX.XXX/XXXX-XX
};
