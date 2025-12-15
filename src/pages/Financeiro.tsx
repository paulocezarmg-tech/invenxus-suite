import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTableHead, useSorting } from "@/components/shared/SortableTableHead";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, TrendingUp, TrendingDown, Percent, Pencil, Trash2, FileText, Download, BarChart3, Sparkles, Wallet, PiggyBank, Target, FileSpreadsheet, PieChart, ArrowUpDown } from "lucide-react";
import { FinanceiroDialog } from "@/components/financeiro/FinanceiroDialog";
import { MigrateButton } from "@/components/financeiro/MigrateButton";
import { DashboardFinanceiro } from "@/components/financeiro/DashboardFinanceiro";
import { IAFinanceiraDialog } from "@/components/financeiro/IAFinanceiraDialog";
import { MapaLucro } from "@/components/financeiro/MapaLucro";
import { GraficosAvancados, CATEGORIAS } from "@/components/financeiro/GraficosAvancados";
import { MetasFinanceiras } from "@/components/financeiro/MetasFinanceiras";
import { ComparativoPeriodos } from "@/components/financeiro/ComparativoPeriodos";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToCSV, ExportColumn } from "@/lib/export-utils";

export default function Financeiro() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState("movimentacoes");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [isIADialogOpen, setIsIADialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { userRole, isAdmin, isSuperAdmin, isLoading: isLoadingRole } = useUserRole();

  // Fetch products and kits first (needed for queries)
  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: kits } = useQuery({
    queryKey: ["kits-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kits")
        .select("id, name, sku")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: movementsData, isLoading, refetch } = useQuery({
    queryKey: ["financeiro", filterType, filterProduct, startDate, endDate, filterMode],
    queryFn: async () => {
      let query = supabase
        .from("financeiro")
        .select(`
          *,
          products (
            id,
            name,
            sku
          )
        `)
        .order("data", { ascending: false });

      // Apply filterMode first
      if (filterMode === "vendas") {
        query = query.eq("tipo", "saida");
      } else if (filterMode === "custos") {
        // Show all movements but focus on costs
      } else if (filterMode === "lucro") {
        query = query.eq("tipo", "saida").gt("lucro_liquido", 0);
      }

      if (filterType !== "all" && filterMode === "all") {
        query = query.eq("tipo", filterType);
      }

      if (filterProduct !== "all") {
        const selectedItem = [...(products || []), ...(kits || [])].find(item => item.id === filterProduct);
        if (selectedItem) {
          query = query.or(`produto_id.eq.${filterProduct},descricao.ilike.%${selectedItem.name}%`);
        }
      }

      if (startDate) {
        query = query.gte("data", startDate);
      }

      if (endDate) {
        query = query.lte("data", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { sortConfig, handleSort, sortedData: movements } = useSorting(movementsData, "data", "desc");

  // Calculate metrics
  const totalFaturamento = movements?.reduce((sum, m) => {
    if (m.tipo === "saida") {
      return sum + (parseFloat(m.valor?.toString() || "0"));
    }
    return sum;
  }, 0) || 0;

  const totalCusto = movements?.reduce((sum, m) => {
    return sum + parseFloat(m.custo_total?.toString() || "0");
  }, 0) || 0;

  const lucroLiquido = totalFaturamento - totalCusto;
  const margemLucro = totalFaturamento > 0 ? (lucroLiquido / totalFaturamento) * 100 : 0;

  // Chart data
  const chartData = useMemo(() => {
    if (!movements) return { monthly: [], products: [] };

    const monthlyData: Record<string, { faturamento: number; custo: number; lucro: number }> = {};
    
    movements.forEach(m => {
      const monthKey = format(new Date(m.data), "MMM/yy", { locale: ptBR });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { faturamento: 0, custo: 0, lucro: 0 };
      }
      
      const valor = m.tipo === "saida" ? parseFloat(m.valor?.toString() || "0") : 0;
      const custo = parseFloat(m.custo_total?.toString() || "0");
      
      monthlyData[monthKey].faturamento += valor;
      monthlyData[monthKey].custo += custo;
      monthlyData[monthKey].lucro += m.tipo === "saida" ? (valor - custo) : 0;
    });

    const monthly = Object.entries(monthlyData).map(([mes, data]) => ({
      mes,
      faturamento: data.faturamento,
      custo: data.custo,
      lucro: data.lucro,
    }));

    const productData: Record<string, { lucro: number; vendas: number; nome: string }> = {};
    
    movements.forEach(m => {
      if (m.tipo !== "saida") return;
      
      const produto = products?.find(p => p.id === m.produto_id);
      const nome = produto?.name || m.descricao;
      
      if (!productData[nome]) {
        productData[nome] = { lucro: 0, vendas: 0, nome };
      }
      
      productData[nome].lucro += parseFloat(m.lucro_liquido?.toString() || "0");
      productData[nome].vendas += parseFloat(m.valor?.toString() || "0");
    });

    const productsArray = Object.values(productData)
      .sort((a, b) => b.lucro - a.lucro)
      .slice(0, 5);

    return { monthly, products: productsArray };
  }, [movements, products]);

  // Permission checks after hooks
  if (!isLoadingRole && !isAdmin() && !isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4 p-8">
          <div className="h-20 w-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Wallet className="h-10 w-10 text-destructive" />
          </div>
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  const exportPDF = async () => {
    try {
      toast({
        title: "Gerando PDF",
        description: "Aguarde enquanto o relatório é gerado...",
      });

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129);
      doc.text("Relatório Financeiro", pageWidth / 2, 25, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 32, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(40);
      doc.text("Resumo Financeiro", 14, 50);

      const summaryData = [
        ["Faturamento Total", formatCurrency(totalFaturamento)],
        ["Custo Total", formatCurrency(totalCusto)],
        ["Lucro Líquido", formatCurrency(lucroLiquido)],
        ["Margem de Lucro", `${margemLucro.toFixed(1)}%`],
      ];

      autoTable(doc, {
        startY: 55,
        head: [["Métrica", "Valor"]],
        body: summaryData,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 14, right: 14 },
      });

      if (chartData.monthly.length > 0) {
        const finalY = (doc as any).lastAutoTable.finalY || 55;
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text("Evolução Mensal", 14, finalY + 15);

        const monthlyTableData = chartData.monthly.map(item => [
          item.mes,
          formatCurrency(item.faturamento),
          formatCurrency(item.custo),
          formatCurrency(item.lucro),
        ]);

        autoTable(doc, {
          startY: finalY + 20,
          head: [["Mês", "Faturamento", "Custo Total", "Lucro Líquido"]],
          body: monthlyTableData,
          theme: "grid",
          headStyles: { fillColor: [16, 185, 129] },
          margin: { left: 14, right: 14 },
        });
      }

      if (chartData.products.length > 0) {
        const finalY = (doc as any).lastAutoTable.finalY || 120;
        
        if (finalY > 220) {
          doc.addPage();
          doc.setFontSize(14);
          doc.setTextColor(40);
          doc.text("Top 5 Produtos Mais Lucrativos", 14, 20);
          
          const productsTableData = chartData.products.map((item, index) => [
            `${index + 1}º`,
            item.nome,
            formatCurrency(item.vendas),
            formatCurrency(item.lucro),
          ]);

          autoTable(doc, {
            startY: 25,
            head: [["Posição", "Produto", "Faturamento", "Lucro Líquido"]],
            body: productsTableData,
            theme: "grid",
            headStyles: { fillColor: [16, 185, 129] },
            margin: { left: 14, right: 14 },
          });
        } else {
          doc.setFontSize(14);
          doc.setTextColor(40);
          doc.text("Top 5 Produtos Mais Lucrativos", 14, finalY + 15);

          const productsTableData = chartData.products.map((item, index) => [
            `${index + 1}º`,
            item.nome,
            formatCurrency(item.vendas),
            formatCurrency(item.lucro),
          ]);

          autoTable(doc, {
            startY: finalY + 20,
            head: [["Posição", "Produto", "Faturamento", "Lucro Líquido"]],
            body: productsTableData,
            theme: "grid",
            headStyles: { fillColor: [16, 185, 129] },
            margin: { left: 14, right: 14 },
          });
        }
      }

      const fileName = `relatorio-financeiro-${format(new Date(), "dd-MM-yyyy")}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF gerado com sucesso",
        description: `O arquivo ${fileName} foi baixado.`,
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (movement: any) => {
    setSelectedMovement(movement);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta movimentação?")) return;

    const { error } = await supabase.from("financeiro").delete().eq("id", id);

    if (error) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Movimentação excluída",
        description: "A movimentação foi excluída com sucesso.",
      });
      refetch();
    }
  };

  // Export columns configuration
  const financeiroExportColumns: ExportColumn[] = [
    { 
      header: "Data", 
      key: "data",
      transform: (value) => format(new Date(value), "dd/MM/yyyy", { locale: ptBR })
    },
    { 
      header: "Tipo", 
      key: "tipo",
      transform: (value) => value === "entrada" ? "Entrada" : "Saída"
    },
    { header: "Descrição", key: "descricao" },
    { 
      header: "Produto", 
      key: "products.name",
      transform: (value, row) => row.products?.name || "-"
    },
    { header: "Quantidade", key: "quantidade", transform: (value) => value || "-" },
    { 
      header: "Valor", 
      key: "valor",
      transform: (value) => formatCurrency(parseFloat(value || "0"))
    },
    { 
      header: "Custo Total", 
      key: "custo_total",
      transform: (value) => formatCurrency(parseFloat(value || "0"))
    },
    { 
      header: "Preço Venda", 
      key: "preco_venda",
      transform: (value) => formatCurrency(parseFloat(value || "0"))
    },
    { 
      header: "Lucro Líquido", 
      key: "lucro_liquido",
      transform: (value) => formatCurrency(parseFloat(value || "0"))
    },
    { 
      header: "Margem %", 
      key: "margem_percentual",
      transform: (value) => `${parseFloat(value || "0").toFixed(1)}%`
    },
  ];

  const handleExportExcel = () => {
    if (!movements || movements.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }
    exportToExcel(movements, financeiroExportColumns, "financeiro");
    toast({
      title: "Exportação concluída",
      description: "Arquivo Excel exportado com sucesso!",
    });
  };

  const handleExportCSV = () => {
    if (!movements || movements.length === 0) {
      toast({
        title: "Erro",
        description: "Não há dados para exportar",
        variant: "destructive",
      });
      return;
    }
    exportToCSV(movements, financeiroExportColumns, "financeiro");
    toast({
      title: "Exportação concluída",
      description: "Arquivo CSV exportado com sucesso!",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-8 space-y-8 animate-fade-in">
        {/* Premium Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-success/5 rounded-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:justify-between md:items-start p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-success to-success/80 flex items-center justify-center shadow-lg shadow-success/25">
                  <Wallet className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    Painel Financeiro
                  </h1>
                  <p className="text-base text-muted-foreground">
                    Controle completo de custos e lucratividade
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <MigrateButton />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-12 gap-2 rounded-xl border-border/50">
                    <Download className="h-4 w-4" />
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
                  <DropdownMenuItem onClick={exportPDF} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Exportar PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                onClick={() => setIsIADialogOpen(true)} 
                variant="outline" 
                className="h-12 border-primary/50 text-primary hover:bg-primary/10 rounded-xl gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Análise IA
              </Button>
              <Button 
                onClick={() => { setSelectedMovement(null); setIsDialogOpen(true); }} 
                className="h-12 gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                <Plus className="h-4 w-4" />
                Nova Movimentação
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs Premium */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="inline-flex h-14 items-center justify-center rounded-2xl bg-muted/50 p-1.5 backdrop-blur-sm border border-border/50 flex-wrap gap-1">
            <TabsTrigger 
              value="dashboard" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger 
              value="movimentacoes" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <FileText className="h-4 w-4 mr-2" />
              Movimentações
            </TabsTrigger>
            <TabsTrigger 
              value="graficos" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <PieChart className="h-4 w-4 mr-2" />
              Gráficos
            </TabsTrigger>
            <TabsTrigger 
              value="metas" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <Target className="h-4 w-4 mr-2" />
              Metas
            </TabsTrigger>
            <TabsTrigger 
              value="comparativo" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Comparativo
            </TabsTrigger>
            <TabsTrigger 
              value="mapa" 
              className="rounded-xl px-4 py-3 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              <PiggyBank className="h-4 w-4 mr-2" />
              Mapa de Lucro
            </TabsTrigger>
          </TabsList>

          {/* Metric Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card 
              className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => {
                setFilterMode(filterMode === "vendas" ? "all" : "vendas");
                setFilterType("all");
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento Total</CardTitle>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight">{formatCurrency(totalFaturamento)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterMode === "vendas" ? "Filtrando vendas" : "Total de vendas realizadas"}
                </p>
              </CardContent>
            </Card>

            <Card 
              className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => {
                setFilterMode(filterMode === "custos" ? "all" : "custos");
                setFilterType("all");
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Custo Total</CardTitle>
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-destructive" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold tracking-tight text-destructive">{formatCurrency(totalCusto)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterMode === "custos" ? "Filtrando custos" : "Custos + despesas operacionais"}
                </p>
              </CardContent>
            </Card>

            <Card 
              className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => {
                setFilterMode(filterMode === "lucro" ? "all" : "lucro");
                setFilterType("all");
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${lucroLiquido >= 0 ? 'from-success/5' : 'from-destructive/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Lucro Líquido</CardTitle>
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${lucroLiquido >= 0 ? 'bg-gradient-to-br from-success/20 to-success/10' : 'bg-gradient-to-br from-destructive/20 to-destructive/10'}`}>
                  <TrendingUp className={`h-6 w-6 ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(lucroLiquido)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filterMode === "lucro" ? "Filtrando com lucro" : "Faturamento - custos totais"}
                </p>
              </CardContent>
            </Card>

            <Card 
              className="group relative overflow-hidden border-0 bg-gradient-to-br from-card to-card/80 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              onClick={() => {
                const now = new Date();
                setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
                setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
                setFilterMode("all");
              }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${margemLucro >= 0 ? 'from-success/5' : 'from-destructive/5'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Margem de Lucro</CardTitle>
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${margemLucro >= 0 ? 'bg-gradient-to-br from-success/20 to-success/10' : 'bg-gradient-to-br from-destructive/20 to-destructive/10'}`}>
                  <Percent className={`h-6 w-6 ${margemLucro >= 0 ? 'text-success' : 'text-destructive'}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold tracking-tight ${margemLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {margemLucro.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {startDate && endDate ? "Clique para mês atual" : "Percentual de lucro sobre vendas"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardFinanceiro />
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movimentacoes" className="space-y-6">
            {/* Filters */}
            <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
              <CardHeader className="pb-4 border-b border-border/50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="entrada">Compras</SelectItem>
                        <SelectItem value="saida">Vendas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Produto</label>
                    <Select value={filterProduct} onValueChange={setFilterProduct}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {products && products.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Produtos
                            </div>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {kits && kits.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Kits
                            </div>
                            {kits.map((kit) => (
                              <SelectItem key={kit.id} value={kit.id}>
                                {kit.name}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Movements Table */}
            <Card className="border-0 shadow-card overflow-hidden bg-gradient-to-br from-card to-card/80">
              <CardHeader className="border-b border-border/50 bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Movimentações Financeiras
                  </CardTitle>
                  <Badge variant="secondary" className="rounded-full px-3">
                    {movements?.length || 0} registros
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <SortableTableHead sortKey="data" currentSort={sortConfig} onSort={handleSort} className="font-semibold">Data</SortableTableHead>
                        <SortableTableHead sortKey="tipo" currentSort={sortConfig} onSort={handleSort} className="font-semibold">Tipo</SortableTableHead>
                        <SortableTableHead sortKey="descricao" currentSort={sortConfig} onSort={handleSort} className="font-semibold">Referência</SortableTableHead>
                        <SortableTableHead sortKey="quantidade" currentSort={sortConfig} onSort={handleSort} className="text-right font-semibold">Qtd</SortableTableHead>
                        <SortableTableHead sortKey="valor" currentSort={sortConfig} onSort={handleSort} className="text-right font-semibold">Venda</SortableTableHead>
                        <SortableTableHead sortKey="custo_total" currentSort={sortConfig} onSort={handleSort} className="text-right font-semibold">Custo</SortableTableHead>
                        <SortableTableHead sortKey="lucro_liquido" currentSort={sortConfig} onSort={handleSort} className="text-right font-semibold">Lucro</SortableTableHead>
                        <TableHead className="text-right font-semibold">Custos Adic.</TableHead>
                        <TableHead className="text-right font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32">
                            <div className="flex items-center justify-center gap-3">
                              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              <span className="text-muted-foreground">Carregando movimentações...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : movements?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-32">
                            <div className="flex flex-col items-center justify-center gap-3 text-center">
                              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground">Nenhuma movimentação encontrada</p>
                                <p className="text-sm text-muted-foreground/70">Registre sua primeira movimentação financeira</p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        movements?.map((movement, index) => {
                          const product = products?.find(p => p.id === movement.produto_id);
                          const custosAdic = Array.isArray(movement.custos_adicionais) 
                            ? movement.custos_adicionais.reduce((sum: number, c: any) => sum + (c.valor || 0), 0)
                            : 0;

                          return (
                            <TableRow 
                              key={movement.id} 
                              className="group hover:bg-muted/50 transition-colors"
                              style={{ animationDelay: `${index * 30}ms` }}
                            >
                              <TableCell className="font-medium">
                                {format(new Date(movement.data), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={movement.tipo === "entrada" ? "secondary" : "default"}
                                  className={`rounded-full ${movement.tipo === "saida" ? 'bg-success/10 text-success border-success/20' : 'bg-primary/10 text-primary border-primary/20'}`}
                                >
                                  {movement.tipo === "entrada" ? "Compra" : "Venda"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{movement.descricao}</div>
                                  {product && <div className="text-xs text-muted-foreground">{product.name}</div>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{movement.quantidade || "-"}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(parseFloat(movement.preco_venda?.toString() || movement.valor?.toString() || "0"))}
                              </TableCell>
                              <TableCell className="text-right text-destructive">
                                {formatCurrency(parseFloat(movement.custo_total?.toString() || "0"))}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold ${parseFloat(movement.lucro_liquido?.toString() || "0") >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {formatCurrency(parseFloat(movement.lucro_liquido?.toString() || "0"))}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {custosAdic > 0 ? (
                                  <div className="text-xs">
                                    <div className="font-medium">{formatCurrency(custosAdic)}</div>
                                    {Array.isArray(movement.custos_adicionais) && movement.custos_adicionais.length > 0 && (
                                      <div className="text-muted-foreground">
                                        {movement.custos_adicionais.map((c: any) => c.descricao).join(", ")}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary"
                                    onClick={() => handleEdit(movement)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {(userRole === "admin" || userRole === "superadmin") && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-9 w-9 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => handleDelete(movement.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profit Map Tab */}
          <TabsContent value="mapa" className="space-y-6">
            <MapaLucro />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="relatorios" className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">Análises e Relatórios</h2>
                <p className="text-muted-foreground">Visualize tendências e insights do seu negócio</p>
              </div>
              <Button 
                onClick={exportPDF} 
                variant="outline" 
                className="h-12 rounded-xl gap-2 border-primary/50 hover:bg-primary/10"
              >
                <Download className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>

            {/* Monthly Evolution Chart */}
            <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolução Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="faturamento" stroke="hsl(var(--primary))" name="Faturamento" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="custo" stroke="hsl(var(--destructive))" name="Custo Total" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="lucro" stroke="hsl(var(--success))" name="Lucro Líquido" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Products Chart */}
            <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top 5 Produtos Mais Lucrativos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.products}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="nome" angle={-15} textAnchor="end" height={100} stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="lucro" fill="hsl(var(--success))" name="Lucro Líquido" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vendas" fill="hsl(var(--primary))" name="Faturamento" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Resumo do Período
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                    <span className="text-muted-foreground">Total de Vendas:</span>
                    <span className="font-bold text-lg">{movements?.filter(m => m.tipo === "saida").length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                    <span className="text-muted-foreground">Total de Compras:</span>
                    <span className="font-bold text-lg">{movements?.filter(m => m.tipo === "entrada").length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30">
                    <span className="text-muted-foreground">Ticket Médio:</span>
                    <span className="font-bold text-lg">
                      {formatCurrency(
                        movements?.filter(m => m.tipo === "saida").length 
                          ? totalFaturamento / movements.filter(m => m.tipo === "saida").length 
                          : 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-success/10">
                    <span className="text-muted-foreground">Lucro Médio/Venda:</span>
                    <span className="font-bold text-lg text-success">
                      {formatCurrency(
                        movements?.filter(m => m.tipo === "saida").length 
                          ? lucroLiquido / movements.filter(m => m.tipo === "saida").length 
                          : 0
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-card bg-gradient-to-br from-card to-card/80">
                <CardHeader className="border-b border-border/50">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Indicadores de Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">ROI (Retorno sobre Investimento)</span>
                      <span className={`text-sm font-bold ${totalCusto > 0 && (lucroLiquido / totalCusto) * 100 >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {totalCusto > 0 ? `${((lucroLiquido / totalCusto) * 100).toFixed(1)}%` : "0%"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${totalCusto > 0 && (lucroLiquido / totalCusto) * 100 >= 0 ? 'bg-success' : 'bg-destructive'}`}
                        style={{ width: `${Math.min(Math.abs((lucroLiquido / totalCusto) * 100), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Margem de Lucro</span>
                      <span className={`text-sm font-bold ${margemLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {margemLucro.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${margemLucro >= 0 ? 'bg-success' : 'bg-destructive'}`}
                        style={{ width: `${Math.min(Math.abs(margemLucro), 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Eficiência de Custos</span>
                      <span className="text-sm font-bold text-primary">
                        {totalFaturamento > 0 ? `${((1 - (totalCusto / totalFaturamento)) * 100).toFixed(1)}%` : "0%"}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(Math.max((1 - (totalCusto / totalFaturamento)) * 100, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <FinanceiroDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          movement={selectedMovement}
          onSuccess={() => refetch()}
        />

        <IAFinanceiraDialog
          open={isIADialogOpen}
          onOpenChange={setIsIADialogOpen}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
    </div>
  );
}