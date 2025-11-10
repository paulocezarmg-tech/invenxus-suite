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
      
      // Add logo
      const imgWidth = 30;
      const imgHeight = 30;
      doc.addImage(logo, "PNG", 14, 10, imgWidth, imgHeight);
      
      // Add title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("StockMaster CMS", 50, 20);
      
      doc.setFontSize(16);
      doc.text("Relatório de Inventário", 50, 30);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 50, 37);

      // Add table
      autoTable(doc, {
        startY: 50,
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
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

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

      const doc = new jsPDF();
      
      // Add logo
      const imgWidth = 30;
      const imgHeight = 30;
      doc.addImage(logo, "PNG", 14, 10, imgWidth, imgHeight);
      
      // Add title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("StockMaster CMS", 50, 20);
      
      doc.setFontSize(16);
      doc.text("Relatório de Movimentações", 50, 30);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 50, 37);

      // Add table
      autoTable(doc, {
        startY: 50,
        head: [["Data", "Tipo", "Produto", "SKU", "Qtd", "Origem", "Destino", "Ref", "Obs"]],
        body: data.map((m: any) => [
          new Date(m.created_at).toLocaleString("pt-BR"),
          m.type === "IN" ? "Entrada" : m.type === "OUT" ? "Saída" : "Transfer",
          m.products?.name || m.kits?.name || "-",
          m.products?.sku || m.kits?.sku || "-",
          m.quantity,
          m.from_location?.name || "-",
          m.to_location?.name || "-",
          m.reference || "-",
          m.note || "-",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

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
        ["Data", "Tipo", "Produto", "SKU", "Quantidade", "Origem", "Destino", "Referência", "Observação"],
        ...data.map((m: any) => [
          new Date(m.created_at).toLocaleString("pt-BR"),
          m.type === "IN" ? "Entrada" : m.type === "OUT" ? "Saída" : "Transferência",
          m.products?.name || m.kits?.name || "",
          m.products?.sku || m.kits?.sku || "",
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
