import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { MovementsReportTable } from "@/components/reports/MovementsReportTable";
import { Download, FileText, Package, TrendingUp, Activity, DollarSign, Users, Box, AlertTriangle, BarChart3, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/stockmaster-logo.png";
import { useOrganization } from "@/hooks/useOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  exportFinancialReport,
  exportAccountsReport,
  exportSuppliersReport,
  exportKitsReport,
  exportCriticalStockReport,
  exportPerformanceReport
} from "@/lib/report-exports";
import { addPDFHeader, addPDFFooter, addPDFSummary, getPDFTableStyles } from "@/lib/pdf-helpers";

const Reports = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const { data: organizationId } = useOrganization();
  const { isAdmin, isSuperAdmin, isLoading: isLoadingRole } = useUserRole();

  // Redirect if not admin or superadmin
  if (!isLoadingRole && !isAdmin() && !isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Esta funcionalidade está disponível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

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
      const totalValue = data.reduce((sum: number, p: any) => sum + Number(p.cost) * Number(p.quantity), 0);
      
      const startY = addPDFHeader({
        doc,
        title: "Relatório de Inventário",
        stats: [
          { label: "Total de Produtos", value: data.length },
          { label: "Valor Total", value: `R$ ${totalValue.toFixed(2)}` }
        ]
      });

      autoTable(doc, {
        startY,
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
        ...getPDFTableStyles(),
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
          const pageCount = (doc as any).internal.getNumberOfPages();
          addPDFFooter(doc, data.pageNumber, pageCount);
        },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      addPDFSummary(doc, finalY, "Resumo do Inventário", [
        { label: "Total de Produtos", value: data.length },
        { label: "Valor Total em Estoque", value: `R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      ]);

      doc.save(`inventario_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Relatório PDF exportado com sucesso");
    } catch (error: any) {
      toast.error(error.message || "Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  const exportMovementsPDF = async () => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    
    setIsExporting(true);
    try {
      let movementsQuery = supabase
        .from("movements")
        .select(`
          created_at,
          type,
          quantity,
          reference,
          note,
          product_id,
          products (id, sku, name, quantity),
          kits (sku, name),
          from_location:locations!movements_from_location_id_fkey (name),
          to_location:locations!movements_to_location_id_fkey (name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true });

      if (dateFrom && dateTo) {
        movementsQuery = movementsQuery
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      }

      const { data: movements, error } = await movementsQuery;
      if (error) throw error;

      const productIds = [...new Set(movements?.filter((m: any) => m.product_id).map((m: any) => m.product_id))];
      const initialStocks: Record<string, number> = {};
      
      for (const productId of productIds) {
        if (!productId) continue;
        
        const { data: productData } = await supabase
          .from("products")
          .select("quantity")
          .eq("id", productId)
          .single();
        
        if (!productData) continue;
        
        let currentStock = Number(productData.quantity);
        
        if (dateFrom) {
          const { data: futureMovements } = await supabase
            .from("movements")
            .select("type, quantity")
            .eq("product_id", productId)
            .gte("created_at", dateFrom.toISOString());
          
          futureMovements?.forEach((m: any) => {
            if (m.type === "IN") {
              currentStock -= Number(m.quantity);
            } else if (m.type === "OUT") {
              currentStock += Number(m.quantity);
            }
          });
        }
        
        initialStocks[productId] = currentStock;
      }

      const processedMovements = movements?.map((m: any, index: number) => {
        const productId = m.product_id;
        
        if (!productId) {
          return { ...m, saldo: null };
        }
        
        let saldo = initialStocks[productId] || 0;
        
        for (let i = 0; i <= index; i++) {
          const mov = movements[i];
          if (mov.product_id === productId) {
            if (mov.type === "IN") {
              saldo += Number(mov.quantity);
            } else if (mov.type === "OUT") {
              saldo -= Number(mov.quantity);
            }
          }
        }
        
        return { ...m, saldo };
      }) || [];

      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.width;
      const startY = addPDFHeader({
        doc,
        title: "Relatório de Movimentações",
        subtitle: dateFrom && dateTo 
          ? `Período: ${dateFrom.toLocaleDateString("pt-BR")} - ${dateTo.toLocaleDateString("pt-BR")}`
          : "Todos os períodos",
        stats: [{ label: "Total", value: processedMovements.length }]
      });

      autoTable(doc, {
        startY,
        head: [["Data e Hora", "Tipo", "Produto", "Qtd", "Origem", "Destino", "Saldo", "Obs"]],
        body: processedMovements.map((m: any) => [
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
          m.saldo !== null ? m.saldo.toString() : "-",
          m.note || "-",
        ]),
        ...getPDFTableStyles(),
        columnStyles: {
          0: { cellWidth: 35, fontSize: 7 },
          1: { halign: 'center', cellWidth: 22 },
          2: { cellWidth: 55, halign: 'left' },
          3: { halign: 'center', cellWidth: 15 },
          4: { cellWidth: 28 },
          5: { cellWidth: 28 },
          6: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
          7: { cellWidth: 45 },
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const cellValue = data.cell.raw as string;
            if (cellValue === "Entrada") {
              doc.setFillColor(220, 252, 231);
              doc.setTextColor(22, 163, 74);
            } else if (cellValue === "Saída") {
              doc.setFillColor(254, 226, 226);
              doc.setTextColor(220, 38, 38);
            } else if (cellValue === "Transferência") {
              doc.setFillColor(219, 234, 254);
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
          doc.setTextColor(156, 163, 175);
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
        // Calculate totals by type
        const totalIn = processedMovements.filter((m: any) => m.type === "IN").length;
        const totalOut = processedMovements.filter((m: any) => m.type === "OUT").length;
        const totalTransfer = processedMovements.filter((m: any) => m.type === "TRANSFER").length;
        
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(14, finalY, pageWidth - 28, 18, 2, 2, 'FD');
        
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 64, 175);
        doc.text("Resumo das Movimentações", 18, finalY + 8);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text(`Total: ${processedMovements.length}`, 18, finalY + 14);
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Visualize e exporte relatórios do sistema</p>
        </div>
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      {/* Opções de Exportação - Grid Completo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Inventário</CardTitle>
            </div>
            <CardDescription className="text-xs">Produtos em estoque</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button 
              onClick={exportInventoryPDF} 
              disabled={isExporting} 
              className="flex-1 h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button 
              onClick={exportInventory} 
              disabled={isExporting} 
              variant="outline" 
              className="flex-1 h-9 text-xs"
              size="sm"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Movimentações</CardTitle>
            </div>
            <CardDescription className="text-xs">Entradas e saídas</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button 
              onClick={exportMovementsPDF} 
              disabled={isExporting} 
              className="flex-1 h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button 
              onClick={exportMovements} 
              disabled={isExporting} 
              variant="outline" 
              className="flex-1 h-9 text-xs"
              size="sm"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Financeiro</CardTitle>
            </div>
            <CardDescription className="text-xs">Receitas e despesas</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportFinancialReport(organizationId, dateFrom, dateTo)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Contas</CardTitle>
            </div>
            <CardDescription className="text-xs">Pagar e receber</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportAccountsReport(organizationId, dateFrom, dateTo)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Fornecedores</CardTitle>
            </div>
            <CardDescription className="text-xs">Cadastro completo</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportSuppliersReport(organizationId)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Kits</CardTitle>
            </div>
            <CardDescription className="text-xs">Produtos agrupados</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportKitsReport(organizationId)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Estoque Crítico</CardTitle>
            </div>
            <CardDescription className="text-xs">Produtos em falta</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportCriticalStockReport(organizationId)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
              variant="outline"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-success" />
              <CardTitle className="text-base">Performance</CardTitle>
            </div>
            <CardDescription className="text-xs">Métricas gerais</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => organizationId && exportPerformanceReport(organizationId, dateFrom, dateTo)} 
              disabled={isExporting || !organizationId} 
              className="w-full h-9 text-xs"
              size="sm"
              variant="outline"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>
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

      {/* Visualização do Relatório de Movimentações */}
      <MovementsReportTable dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  );
};

export default Reports;
