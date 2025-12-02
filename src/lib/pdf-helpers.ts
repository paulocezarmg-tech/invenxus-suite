import jsPDF from "jspdf";
import logo from "@/assets/stockmaster-logo.png";

export interface PDFHeaderOptions {
  doc: jsPDF;
  title: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string | number }>;
}

export const addPDFHeader = ({ doc, title, subtitle, stats }: PDFHeaderOptions) => {
  const pageWidth = doc.internal.pageSize.width;
  
  // Header with logo
  doc.addImage(logo, "PNG", 14, 12, 25, 25);
  
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 175);
  doc.text("StockMaster CMS", 45, 22);
  
  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(title, 45, 32);
  
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(subtitle, 45, 38);
  }
  
  // Info box
  const infoBoxY = subtitle ? 44 : 40;
  doc.setDrawColor(229, 231, 235);
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, infoBoxY, pageWidth - 28, 10, 2, 2, 'FD');
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Gerado em: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
    18,
    infoBoxY + 6
  );
  
  // Add stats if provided
  if (stats && stats.length > 0) {
    const statX = pageWidth / 2;
    stats.forEach((stat, index) => {
      doc.text(
        `${stat.label}: ${stat.value}`,
        statX + (index * 60),
        infoBoxY + 6
      );
    });
  }
  
  return subtitle ? 58 : 54;
};

export const addPDFFooter = (doc: jsPDF, pageNumber: number, totalPages: number) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Página ${pageNumber} de ${totalPages}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
};

export const addPDFSummary = (
  doc: jsPDF,
  startY: number,
  title: string,
  items: Array<{ label: string; value: string | number }>
) => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  
  if (startY < pageHeight - 35) {
    doc.setDrawColor(229, 231, 235);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, startY, pageWidth - 28, 8 + (items.length * 6), 2, 2, 'FD');
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(title, 18, startY + 6);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    
    items.forEach((item, index) => {
      const yPos = startY + 12 + (index * 6);
      doc.text(`${item.label}: ${item.value}`, 18, yPos);
    });
  }
};

export const getPDFTableStyles = () => ({
  styles: { 
    fontSize: 8,
    cellPadding: 4,
    lineColor: [229, 231, 235] as [number, number, number],
    lineWidth: 0.5,
    valign: 'middle' as const,
  },
  headStyles: { 
    fillColor: [59, 130, 246] as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: 'bold' as const,
    halign: 'center' as const,
    fontSize: 9,
  },
  alternateRowStyles: {
    fillColor: [249, 250, 251] as [number, number, number],
  },
});
