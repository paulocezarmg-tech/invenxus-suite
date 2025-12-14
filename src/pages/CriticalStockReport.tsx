import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, useSorting } from "@/components/shared/SortableTableHead";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, Download, FileSpreadsheet, FileText, Loader2, PackageX, AlertCircle, RefreshCw } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { exportCriticalStockReport } from "@/lib/report-exports";
import { exportToExcel, exportToCSV, ExportColumn } from "@/lib/export-utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CriticalProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  min_quantity: number;
  cost: number;
  preco_venda: number | null;
  categories: { name: string } | null;
  locations: { name: string } | null;
  suppliers: { name: string } | null;
}

export default function CriticalStockReport() {
  const { data: organizationId } = useOrganization();
  const [isExporting, setIsExporting] = useState(false);

  const { data: criticalProducts, isLoading, refetch } = useQuery({
    queryKey: ["critical-stock-report", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          sku,
          name,
          quantity,
          min_quantity,
          cost,
          preco_venda,
          categories (name),
          locations (name),
          suppliers (name)
        `)
        .eq("organization_id", organizationId)
        .order("quantity", { ascending: true });

      if (error) throw error;

      return (data?.filter((p) => Number(p.quantity) <= Number(p.min_quantity)) || []) as CriticalProduct[];
    },
    enabled: !!organizationId,
  });

  const { sortConfig, handleSort, sortedData: sortedProducts } = useSorting(criticalProducts, "quantity", "asc");

  // Statistics
  const zeroStock = criticalProducts?.filter((p) => Number(p.quantity) === 0) || [];
  const lowStock = criticalProducts?.filter((p) => Number(p.quantity) > 0) || [];
  const totalPotentialLoss = criticalProducts?.reduce(
    (acc, p) => acc + (Number(p.preco_venda || 0) * Number(p.min_quantity)),
    0
  ) || 0;
  const totalStockValue = criticalProducts?.reduce(
    (acc, p) => acc + (Number(p.cost) * Number(p.quantity)),
    0
  ) || 0;

  // Export columns
  const exportColumns: ExportColumn[] = [
    { header: "SKU", key: "sku" },
    { header: "Produto", key: "name" },
    {
      header: "Categoria",
      key: "categories.name",
      transform: (value) => value || "-",
    },
    { header: "Quantidade Atual", key: "quantity" },
    { header: "Quantidade Mínima", key: "min_quantity" },
    {
      header: "Status",
      key: "quantity",
      transform: (value) => (Number(value) === 0 ? "SEM ESTOQUE" : "CRÍTICO"),
    },
    {
      header: "Local",
      key: "locations.name",
      transform: (value) => value || "-",
    },
    {
      header: "Fornecedor",
      key: "suppliers.name",
      transform: (value) => value || "-",
    },
    {
      header: "Custo Unitário",
      key: "cost",
      transform: (value) => formatCurrency(Number(value || 0)),
    },
    {
      header: "Preço Venda",
      key: "preco_venda",
      transform: (value) => (value ? formatCurrency(Number(value)) : "-"),
    },
  ];

  const handleExportPDF = async () => {
    if (!organizationId) return;
    setIsExporting(true);
    try {
      await exportCriticalStockReport(organizationId);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!sortedProducts || sortedProducts.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    exportToExcel(sortedProducts, exportColumns, "estoque-critico");
    toast.success("Arquivo Excel exportado com sucesso!");
  };

  const handleExportCSV = () => {
    if (!sortedProducts || sortedProducts.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    exportToCSV(sortedProducts, exportColumns, "estoque-critico");
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/25">
              <AlertTriangle className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Estoque Crítico
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Produtos abaixo do nível mínimo
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="gap-2 h-11 bg-card/80 backdrop-blur-sm border-border/50"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 h-11 bg-card/80 backdrop-blur-sm border-border/50"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Total Crítico
              </CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/5 flex items-center justify-center ring-1 ring-destructive/10">
                <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-destructive">
                {criticalProducts?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">produtos</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Sem Estoque
              </CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center ring-1 ring-danger/10">
                <PackageX className="h-5 w-5 md:h-6 md:w-6 text-danger" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-danger">
                {zeroStock.length}
              </div>
              <p className="text-xs text-muted-foreground">zerados</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Nível Baixo
              </CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center ring-1 ring-warning/10">
                <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-warning">
                {lowStock.length}
              </div>
              <p className="text-xs text-muted-foreground">abaixo do mínimo</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Perda Potencial
              </CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-lg md:text-2xl font-bold tracking-tight">
                {formatCurrency(totalPotentialLoss)}
              </div>
              <p className="text-xs text-muted-foreground">estimado</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Produtos em Estoque Crítico</CardTitle>
              {criticalProducts && criticalProducts.length > 0 && (
                <Badge variant="destructive" className="text-xs font-semibold px-3 py-1">
                  {criticalProducts.length} {criticalProducts.length === 1 ? "item" : "itens"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <SortableTableHead
                      currentSort={sortConfig}
                      onSort={handleSort}
                      sortKey="sku"
                      className="font-semibold text-xs uppercase tracking-wider"
                    >
                      SKU
                    </SortableTableHead>
                    <SortableTableHead
                      currentSort={sortConfig}
                      onSort={handleSort}
                      sortKey="name"
                      className="font-semibold text-xs uppercase tracking-wider"
                    >
                      Produto
                    </SortableTableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Categoria</TableHead>
                    <SortableTableHead
                      currentSort={sortConfig}
                      onSort={handleSort}
                      sortKey="quantity"
                      className="font-semibold text-xs uppercase tracking-wider text-center"
                    >
                      Atual
                    </SortableTableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Mínimo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Status</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Local</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Fornecedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Carregando...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : sortedProducts && sortedProducts.length > 0 ? (
                    sortedProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {product.sku}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium text-sm">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {product.categories?.name || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={Number(product.quantity) === 0 ? "destructive" : "secondary"}
                            className="font-semibold min-w-[40px] justify-center"
                          >
                            {product.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-sm font-medium text-muted-foreground">
                            {product.min_quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(product.quantity) === 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              SEM ESTOQUE
                            </Badge>
                          ) : (
                            <Badge className="bg-warning text-warning-foreground text-xs">
                              CRÍTICO
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {product.locations?.name || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {product.suppliers?.name || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                            <Package className="h-6 w-6 text-success" />
                          </div>
                          <p className="text-sm font-medium">Tudo em ordem!</p>
                          <p className="text-xs">Nenhum produto em estoque crítico</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
