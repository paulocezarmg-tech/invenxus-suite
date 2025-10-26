import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Package, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";

const Reports = () => {
  const [isExporting, setIsExporting] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["report-stats"],
    queryFn: async () => {
      const [productsRes, movementsRes] = await Promise.all([
        supabase.from("products").select("id, cost, quantity", { count: "exact" }),
        supabase.from("movements").select("id", { count: "exact" }),
      ]);

      // Get critical products
      const criticalRes = await supabase.rpc("get_critical_products");

      const totalValue =
        productsRes.data?.reduce((sum, p) => sum + Number(p.cost) * Number(p.quantity), 0) || 0;

      return {
        totalProducts: productsRes.count || 0,
        totalMovements: movementsRes.count || 0,
        criticalProducts: criticalRes.data?.length || 0,
        totalValue,
      };
    },
  });

  const exportInventory = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.from("products").select(`
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
      `);

      if (error) throw error;

      const csv = [
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

      const blob = new Blob([csv], { type: "text/csv" });
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
        from_location:locations!movements_from_location_id_fkey (name),
        to_location:locations!movements_to_location_id_fkey (name)
      `).order("created_at", { ascending: false });

      if (error) throw error;

      const csv = [
        ["Data", "Tipo", "Produto", "SKU", "Quantidade", "Origem", "Destino", "Referência", "Observação"],
        ...data.map((m: any) => [
          new Date(m.created_at).toLocaleString("pt-BR"),
          m.type === "IN" ? "Entrada" : m.type === "OUT" ? "Saída" : "Transferência",
          m.products?.name || "",
          m.products?.sku || "",
          m.quantity,
          m.from_location?.name || "",
          m.to_location?.name || "",
          m.reference || "",
          m.note || "",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
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
      <div>
        <h1 className="text-3xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Gerar e exportar relatórios do sistema</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimentações</CardTitle>
            <Activity className="h-4 w-4 text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMovements || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens Críticos</CardTitle>
            <TrendingUp className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats?.criticalProducts || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-muted">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <FileText className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {(stats?.totalValue || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-muted">
          <CardHeader>
            <CardTitle>Relatório de Inventário</CardTitle>
            <CardDescription>
              Exportar lista completa de produtos com quantidades e valores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportInventory} disabled={isExporting} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar Inventário (CSV)"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card border-muted">
          <CardHeader>
            <CardTitle>Relatório de Movimentações</CardTitle>
            <CardDescription>
              Exportar histórico de entradas, saídas e transferências
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportMovements} disabled={isExporting} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exportando..." : "Exportar Movimentações (CSV)"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
