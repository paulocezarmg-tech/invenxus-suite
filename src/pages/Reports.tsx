import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Download, FileText, Package, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/stockmaster-logo.png";
import { useOrganization } from "@/hooks/useOrganization";

const Reports = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const { data: organizationId } = useOrganization();

  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const { data: stats } = useQuery({
    queryKey: ["report-stats", dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return { totalProducts: 0, totalMovements: 0, criticalProducts: 0, totalValue: 0 };
      
      let movementsQuery = supabase
        .from("movements")
        .select("id", { count: "exact" })
        .eq("organization_id", organizationId);
      
      if (dateFrom && dateTo) {
        movementsQuery = movementsQuery
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      }

      const [productsRes, movementsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, cost, quantity, min_quantity", { count: "exact" })
          .eq("organization_id", organizationId),
        movementsQuery,
      ]);

      // Calculate critical products (quantity <= min_quantity)
      const criticalProducts = productsRes.data?.filter(
        p => Number(p.quantity) <= Number(p.min_quantity)
      ).length || 0;

      const totalValue =
        productsRes.data?.reduce((sum, p) => sum + Number(p.cost) * Number(p.quantity), 0) || 0;

      return {
        totalProducts: productsRes.count || 0,
        totalMovements: movementsRes.count || 0,
        criticalProducts,
        totalValue,
      };
    },
    enabled: !!organizationId,
  });

  const exportInventory = async () => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          sku,
          name,
          barcode,
          quantity,
          min_quantity,
          cost,
          unit,
          categories (name),
          locations (name),
          suppliers (name)
        `)
        .eq("organization_id", organizationId);

      if (error) throw error;

      const currentDate = new Date().toLocaleString("pt-BR");
      const csv = [
        ["StockMaster CMS"],
        ["Relatório de Inventário"],
        [`Gerado em: ${currentDate}`],
        [""],
        ["SKU", "Nome", "Código de Barras", "Quantidade", "Qtd. Mínima", "Custo", "Unidade", "Categoria", "Local", "Fornecedor"],
        ...data.map((p: any) => [
          p.sku,
          p.name,
          p.barcode || "",
          p.quantity,
          p.min_quantity,
          p.cost,
          p.unit,
          p.categories?.name || "",
          p.locations?.name || "",
          p.suppliers?.name || "",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventario_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();

      toast.success("Relatório exportado com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  const exportInventoryPDF = async () => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    
    setIsExporting(true);
    try {
      const { data, error} = await supabase
        .from("products")
        .select(`
          sku,
          name,
          barcode,
          quantity,
          min_quantity,
          cost,
          unit,
          categories (name),
          locations (name),
          suppliers (name)
        `)
        .eq("organization_id", organizationId);

      if (error) throw error;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Header with logo and info
      doc.addImage(logo, "PNG", 14, 12, 25, 25);
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138); // Blue
      doc.text("StockMaster CMS", 45, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(71, 85, 105); // Gray
      doc.text("Relatório de Inventário", 45, 28);
      
      // Info box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(45, 32, pageWidth - 59, 10, 2, 2, 'FD');
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 48, 38);
      doc.text(`Total de Produtos: ${data.length}`, pageWidth - 55, 38);

      // Calculate totals
      const totalValue = data.reduce((sum: number, p: any) => sum + Number(p.cost) * Number(p.quantity), 0);

      // Add table
      autoTable(doc, {
        startY: 48,
        head: [["SKU", "Nome", "Cód. Barras", "Qtd", "Qtd Min", "Custo", "Un", "Categoria", "Local", "Fornecedor"]],
        body: data.map((p: any) => [
          p.sku,
          p.name,
          p.barcode || "-",
          p.quantity,
          p.min_quantity,
          `R$ ${Number(p.cost).toFixed(2)}`,
          p.unit,
          p.categories?.name || "-",
          p.locations?.name || "-",
          p.suppliers?.name || "-",
        ]),
        styles: { 
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        headStyles: { 
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 35 },
          2: { cellWidth: 20 },
          3: { halign: 'center', cellWidth: 12 },
          4: { halign: 'center', cellWidth: 12 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 10 },
          7: { cellWidth: 22 },
          8: { cellWidth: 22 },
          9: { cellWidth: 22 },
        },
        didDrawPage: (data) => {
          // Footer
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
        },
      });

      // Add summary at the end
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, finalY, pageWidth - 28, 18, 2, 2, 'FD');
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.text("Resumo do Inventário", 18, finalY + 7);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Total de Produtos: ${data.length}`, 18, finalY + 14);
      doc.text(`Valor Total em Estoque: R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, pageWidth / 2, finalY + 14);

      doc.save(`inventario_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  const exportMovementsPDF = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.from("movements").select(`
        created_at,
        type,
        quantity,
        reference,
        note,
        products (sku, name),
        kits (sku, name),
        from_location:locations!movements_from_location_id_fkey (name),
        to_location:locations!movements_to_location_id_fkey (name)
      `).order("created_at", { ascending: false });

      if (error) throw error;

      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.width;
      
      // Header with logo and info
      doc.addImage(logo, "PNG", 14, 12, 25, 25);
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138); // Blue
      doc.text("StockMaster CMS", 45, 20);
      
      doc.setFontSize(14);
      doc.setTextColor(71, 85, 105); // Gray
      doc.text("Relatório de Movimentações", 45, 28);
      
      // Info box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(45, 32, pageWidth - 59, 10, 2, 2, 'FD');
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 48, 38);
      doc.text(`Total de Movimentações: ${data.length}`, pageWidth - 75, 38);

      // Calculate totals by type
      const totalIn = data.filter((m: any) => m.type === "IN").length;
      const totalOut = data.filter((m: any) => m.type === "OUT").length;
      const totalTransfer = data.filter((m: any) => m.type === "TRANSFER").length;

      // Add table
      autoTable(doc, {
        startY: 48,
        head: [["Data e Hora", "Tipo", "Produto", "Qtd", "Origem", "Destino", "Ref", "Obs"]],
        body: data.map((m: any) => [
          new Date(m.created_at).toLocaleString("pt-BR", { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          m.type === "IN" ? "Entrada" : m.type === "OUT" ? "Saída" : "Transferência",
          m.products?.name || m.kits?.name || "-",
          m.quantity,
          m.from_location?.name || "-",
          m.to_location?.name || "-",
          m.reference || "-",
          m.note || "-",
        ]),
        styles: { 
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          valign: 'middle',
          halign: 'left',
        },
        headStyles: { 
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 35, fontSize: 7 },
          1: { halign: 'center', cellWidth: 25 },
          2: { cellWidth: 60, halign: 'left' },
          3: { halign: 'center', cellWidth: 15 },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 },
          6: { cellWidth: 25 },
          7: { cellWidth: 45 },
        },
        didDrawCell: (data) => {
          // Color code for movement types
          if (data.section === 'body' && data.column.index === 1) {
            const cellValue = data.cell.raw as string;
            if (cellValue === "Entrada") {
              doc.setFillColor(220, 252, 231); // Green
              doc.setTextColor(22, 163, 74);
            } else if (cellValue === "Saída") {
              doc.setFillColor(254, 226, 226); // Red
              doc.setTextColor(220, 38, 38);
            } else if (cellValue === "Transferência") {
              doc.setFillColor(219, 234, 254); // Blue
              doc.setTextColor(59, 130, 246);
            }
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            doc.text(cellValue, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
              align: 'center',
              baseline: 'middle'
            });
          }
        },
        didDrawPage: (data) => {
          // Footer
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
        },
      });

      // Add summary at the end
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      if (finalY < doc.internal.pageSize.height - 30) {
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, finalY, pageWidth - 28, 18, 2, 2, 'FD');
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text("Resumo das Movimentações", 18, finalY + 7);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Total: ${data.length}`, 18, finalY + 14);
        doc.text(`Entradas: ${totalIn}`, pageWidth / 4, finalY + 14);
        doc.text(`Saídas: ${totalOut}`, pageWidth / 2, finalY + 14);
        doc.text(`Transferências: ${totalTransfer}`, (pageWidth / 4) * 3, finalY + 14);
      }

      doc.save(`movimentacoes_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  const exportMovements = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.from("movements").select(`
        created_at,
        type,
        quantity,
        reference,
        note,
        products (sku, name),
        kits (sku, name),
        from_location:locations!movements_from_location_id_fkey (name),
        to_location:locations!movements_to_location_id_fkey (name)
      `).order("created_at", { ascending: false });

      if (error) throw error;

      const currentDate = new Date().toLocaleString("pt-BR");
      const csv = [
        ["StockMaster CMS"],
        ["Relatório de Movimentações"],
        [`Gerado em: ${currentDate}`],
        [""],
        ["Data e Hora", "Tipo", "Produto", "Quantidade", "Origem", "Destino", "Referência", "Observação"],
        ...data.map((m: any) => [
          new Date(m.created_at).toLocaleString("pt-BR"),
          m.type === "IN" ? "Entrada" : m.type === "OUT" ? "Saída" : "Transferência",
          m.products?.name || m.kits?.name || "",
          m.quantity,
          m.from_location?.name || "",
          m.to_location?.name || "",
          m.reference || "",
          m.note || "",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimentacoes_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();

      toast.success("Relatório exportado com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Gerar e exportar relatórios do sistema</p>
        </div>
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle>
            <Package className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalProducts || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Movimentações</CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalMovements || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Itens Críticos</CardTitle>
            <TrendingUp className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{stats?.criticalProducts || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
            <FileText className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              R$ {(stats?.totalValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader>
            <CardTitle>Relatório de Inventário</CardTitle>
            <CardDescription>
              Exportar lista completa de produtos com quantidades e valores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={exportInventoryPDF} disabled={isExporting} className="w-full gap-2">
              <FileText className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar em PDF"}
            </Button>
            <Button onClick={exportInventory} disabled={isExporting} variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader>
            <CardTitle>Relatório de Movimentações</CardTitle>
            <CardDescription>
              Exportar histórico de entradas, saídas e transferências
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={exportMovementsPDF} disabled={isExporting} className="w-full gap-2">
              <FileText className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar em PDF"}
            </Button>
            <Button onClick={exportMovements} disabled={isExporting} variant="outline" className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
