import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, DollarSign, TrendingUp, TrendingDown, Percent, Pencil, Trash2, FileText, Download, BarChart3 } from "lucide-react";
import { FinanceiroDialog } from "@/components/financeiro/FinanceiroDialog";
import { MigrateButton } from "@/components/financeiro/MigrateButton";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Financeiro() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [activeTab, setActiveTab] = useState("movimentacoes");
  const { toast } = useToast();
  const { userRole, isAdmin, isSuperAdmin, isLoading: isLoadingRole } = useUserRole();

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

  const { data: movements, isLoading, refetch } = useQuery({
    queryKey: ["financeiro", filterType, filterProduct, startDate, endDate],
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

      if (filterType !== "all") {
        query = query.eq("tipo", filterType);
      }

      if (filterProduct !== "all") {
        // Buscar tanto pelo produto_id quanto pela descrição que contém o nome
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

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("active", true)
        .order("name");
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
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calcular métricas de lucro real
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

  // Dados para gráficos de relatórios
  const chartData = useMemo(() => {
    if (!movements) return { monthly: [], products: [], daily: [] };

    // Agrupar por mês
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

    // Agrupar por produto (top 5)
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

    return { monthly, products: productsArray, daily: [] };
  }, [movements, products]);

  const exportPDF = () => {
    toast({
      title: "Exportando relatório",
      description: "A funcionalidade de exportação em PDF será implementada em breve.",
    });
  };

  const handleEdit = (movement: any) => {
    setSelectedMovement(movement);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta movimentação?")) return;

    const { error } = await supabase
      .from("financeiro")
      .delete()
      .eq("id", id);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Painel de Lucro Real</h1>
            <p className="text-base text-muted-foreground">Controle completo de custos e lucratividade</p>
          </div>
          <div className="flex gap-3">
            <MigrateButton />
            <Button onClick={() => { setSelectedMovement(null); setIsDialogOpen(true); }} className="h-11">
              <Plus className="h-4 w-4 mr-2" />
              Nova Movimentação
            </Button>
          </div>
        </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="grid w-full max-w-md grid-cols-2 h-11">
          <TabsTrigger value="movimentacoes" className="text-sm font-medium">
            <FileText className="h-4 w-4 mr-2" />
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="text-sm font-medium">
            <BarChart3 className="h-4 w-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        {/* Cards de Métricas */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Faturamento Total</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalFaturamento)}
            </div>
            <p className="text-sm text-muted-foreground">Total de vendas realizadas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Custo Total</CardTitle>
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight text-destructive">
              {formatCurrency(totalCusto)}
            </div>
            <p className="text-sm text-muted-foreground">Custos + despesas operacionais</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lucro Líquido</CardTitle>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${lucroLiquido >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <TrendingUp className={`h-5 w-5 ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-bold tracking-tight ${lucroLiquido >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(lucroLiquido)}
            </div>
            <p className="text-sm text-muted-foreground">Faturamento - custos totais</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Margem de Lucro</CardTitle>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${margemLucro >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
              <Percent className={`h-5 w-5 ${margemLucro >= 0 ? 'text-success' : 'text-destructive'}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-bold tracking-tight ${margemLucro >= 0 ? 'text-success' : 'text-destructive'}`}>
              {margemLucro.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">Percentual de lucro sobre vendas</p>
          </CardContent>
        </Card>
      </div>

      {/* Aba de Movimentações */}
      <TabsContent value="movimentacoes" className="space-y-6">
        {/* Filtros */}
        <Card className="border-0 shadow-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
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
                <SelectTrigger>
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
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card className="border-0 shadow-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">Movimentações Financeiras</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Custos Adic.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : movements?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      Nenhuma movimentação encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  movements?.map((movement) => {
                    const product = products?.find(p => p.id === movement.produto_id);
                    const custosAdic = Array.isArray(movement.custos_adicionais) 
                      ? movement.custos_adicionais.reduce((sum: number, c: any) => sum + (c.valor || 0), 0)
                      : 0;

                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="font-medium">
                          {format(new Date(movement.data), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={movement.tipo === "entrada" ? "secondary" : "default"}>
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
                          <span className={parseFloat(movement.lucro_liquido?.toString() || "0") >= 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
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
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(movement)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {(userRole === "admin" || userRole === "superadmin") && (
                              <Button
                                variant="ghost"
                                size="icon"
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

      {/* Aba de Relatórios */}
      <TabsContent value="relatorios" className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">Análises e Relatórios</h2>
            <p className="text-base text-muted-foreground">Visualize tendências e insights do seu negócio</p>
          </div>
          <Button onClick={exportPDF} variant="outline" className="h-11">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Gráfico de Evolução Mensal */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Line type="monotone" dataKey="faturamento" stroke="#10b981" name="Faturamento" strokeWidth={2} />
                <Line type="monotone" dataKey="custo" stroke="#ef4444" name="Custo Total" strokeWidth={2} />
                <Line type="monotone" dataKey="lucro" stroke="#3b82f6" name="Lucro Líquido" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Produtos Mais Lucrativos */}
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Top 5 Produtos Mais Lucrativos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.products}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-15} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
                <Bar dataKey="lucro" fill="#10b981" name="Lucro Líquido" />
                <Bar dataKey="vendas" fill="#3b82f6" name="Faturamento" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Análise de Desempenho */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Resumo do Período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de Vendas:</span>
                <span className="font-bold">{movements?.filter(m => m.tipo === "saida").length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total de Compras:</span>
                <span className="font-bold">{movements?.filter(m => m.tipo === "entrada").length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Ticket Médio:</span>
                <span className="font-bold">
                  {formatCurrency(
                    movements?.filter(m => m.tipo === "saida").length 
                      ? totalFaturamento / movements.filter(m => m.tipo === "saida").length 
                      : 0
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Lucro Médio/Venda:</span>
                <span className="font-bold text-green-500">
                  {formatCurrency(
                    movements?.filter(m => m.tipo === "saida").length 
                      ? lucroLiquido / movements.filter(m => m.tipo === "saida").length 
                      : 0
                  )}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Indicadores de Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">ROI (Retorno sobre Investimento)</span>
                  <span className={`text-sm font-bold ${totalCusto > 0 && (lucroLiquido / totalCusto) * 100 >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {totalCusto > 0 ? `${((lucroLiquido / totalCusto) * 100).toFixed(1)}%` : "0%"}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Margem Bruta</span>
                  <span className="text-sm font-bold text-primary">
                    {margemLucro.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Custo / Faturamento</span>
                  <span className="text-sm font-bold">
                    {totalFaturamento > 0 ? `${((totalCusto / totalFaturamento) * 100).toFixed(1)}%` : "0%"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={lucroLiquido >= 0 ? "default" : "destructive"}>
                    {lucroLiquido >= 0 ? "Lucrativo" : "Prejuízo"}
                  </Badge>
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
        onSuccess={() => {
          refetch();
          setIsDialogOpen(false);
          setSelectedMovement(null);
        }}
      />
      </div>
    </div>
  );
}