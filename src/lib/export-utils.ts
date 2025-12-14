import * as XLSX from "xlsx";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExportColumn {
  header: string;
  key: string;
  transform?: (value: any, row: any) => string | number;
}

export function exportToExcel(
  data: any[],
  columns: ExportColumn[],
  fileName: string
) {
  const exportData = data.map((row) => {
    const rowData: Record<string, any> = {};
    columns.forEach((col) => {
      const value = col.key.includes(".")
        ? col.key.split(".").reduce((obj, key) => obj?.[key], row)
        : row[col.key];
      rowData[col.header] = col.transform ? col.transform(value, row) : value;
    });
    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

  // Auto-size columns
  const colWidths = columns.map((col) => ({
    wch: Math.max(
      col.header.length,
      ...exportData.map((row) => String(row[col.header] || "").length)
    ),
  }));
  worksheet["!cols"] = colWidths;

  const dateStr = format(new Date(), "dd-MM-yyyy", { locale: ptBR });
  XLSX.writeFile(workbook, `${fileName}-${dateStr}.xlsx`);
}

export function exportToCSV(
  data: any[],
  columns: ExportColumn[],
  fileName: string
) {
  const exportData = data.map((row) => {
    const rowData: Record<string, any> = {};
    columns.forEach((col) => {
      const value = col.key.includes(".")
        ? col.key.split(".").reduce((obj, key) => obj?.[key], row)
        : row[col.key];
      rowData[col.header] = col.transform ? col.transform(value, row) : value;
    });
    return rowData;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const dateStr = format(new Date(), "dd-MM-yyyy", { locale: ptBR });
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}-${dateStr}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
