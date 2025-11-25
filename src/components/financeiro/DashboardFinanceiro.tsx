import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
import { Download, TrendingUp, DollarSign, Percent, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export const DashboardFinanceiro = () => {
  const { data: organizationId } = useOrganization();
  const { toast } = useToast();
  const chartRef = useRef<HTMLDivElement>(null);
  
  const [periodFilter, setPeriodFilter] = useState<string>("30");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [kitFilter, setKitFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products-dashboard"],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Fetch kits
  const { data: kits } = useQuery({
    queryKey: ["kits-dashboard"],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("kits")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    if (periodFilter === "custom" && customStartDate && customEndDate) {
      start = customStartDate;
      end = customEndDate;
    } else if (periodFilter === "month") {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      const days = parseInt(periodFilter);
      start = subDays(now, days - 1);
    }

    return {
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
    };
  }, [periodFilter, customStartDate, customEndDate]);

  // Fetch financial data
  const { data: financialData, isLoading } = useQuery({
    queryKey: ["dashboard-financial", organizationId, startDate, endDate, productFilter, kitFilter],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("financeiro")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data", { ascending: true });

      if (productFilter !== "all") {
        query = query.eq("produto_id", productFilter);
      }

      if (kitFilter !== "all") {
        query = query.ilike("descricao", `%${kits?.find(k => k.id === kitFilter)?.name || ""}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Calculate previous period data for growth comparison
  const { data: previousPeriodData } = useQuery({
    queryKey: ["dashboard-previous-period", organizationId, startDate, endDate],
    queryFn: async () => {
      if (!organizationId) return [];

      const start = parseISO(startDate);
      const end = parseISO(endDate);
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      
      const prevStart = format(subDays(start, daysDiff), "yyyy-MM-dd");
      const prevEnd = format(subDays(end, daysDiff), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("data", prevStart)
        .lte("data", prevEnd);

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Process chart data
  const chartData = useMemo(() => {
    if (!financialData) return [];

    const dataByDay: Record<string, { faturamento: number; custo: number; lucro: number; vendas: number }> = {};

    financialData.forEach(item => {
      const date = format(parseISO(item.data), "dd/MM", { locale: ptBR });
      
      if (!dataByDay[date]) {
        dataByDay[date] = { faturamento: 0, custo: 0, lucro: 0, vendas: 0 };
      }

      if (item.tipo === "saida") {
        const faturamento = Number(item.valor || 0);
        const custo = Number(item.custo_total || 0);
        
        dataByDay[date].faturamento += faturamento;
        dataByDay[date].custo += custo;
        dataByDay[date].lucro += (faturamento - custo);
        dataByDay[date].vendas += 1;
      }
    });

    return Object.entries(dataByDay).map(([date, values]) => ({
      date,
      faturamento: values.faturamento,
      custo: values.custo,
      lucro: values.lucro,
      vendas: values.vendas,
    }));
  }, [financialData]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!financialData) return { ticketMedio: 0, crescimentoLucro: 0, margemMedia: 0, lucroAcumulado: 0 };

    const currentFaturamento = financialData
      .filter(item => item.tipo === "saida")
      .reduce((sum, item) => sum + Number(item.valor || 0), 0);

    const currentCusto = financialData
      .reduce((sum, item) => sum + Number(item.custo_total || 0), 0);

    const currentLucro = currentFaturamento - currentCusto;

    const totalVendas = financialData.filter(item => item.tipo === "saida").length;

    const ticketMedio = totalVendas > 0 ? currentFaturamento / totalVendas : 0;

    // Previous period metrics
    const previousLucro = previousPeriodData
      ? previousPeriodData
          .filter(item => item.tipo === "saida")
          .reduce((sum, item) => sum + (Number(item.valor || 0) - Number(item.custo_total || 0)), 0)
      : 0;

    const crescimentoLucro = previousLucro > 0 
      ? ((currentLucro - previousLucro) / previousLucro) * 100 
      : 0;

    const margemMedia = currentFaturamento > 0 
      ? (currentLucro / currentFaturamento) * 100 
      : 0;

    return {
      ticketMedio,
      crescimentoLucro,
      margemMedia,
      lucroAcumulado: currentLucro,
    };
  }, [financialData, previousPeriodData]);

  const exportAsImage = async () => {
    if (!chartRef.current) return;

    try {
      toast({
        title: "Gerando imagem",
        description: "Aguarde enquanto a imagem é gerada...",
      });

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `dashboard-financeiro-${format(new Date(), "dd-MM-yyyy")}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast({
        title: "Imagem exportada",
        description: "O gráfico foi baixado como PNG.",
      });
    } catch (error) {
      console.error("Erro ao exportar imagem:", error);
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar a imagem.",
        variant: "destructive",
      });
    }
  };

  const exportAsPDF = async () => {
    if (!chartRef.current) return;

    try {
      toast({
        title: "Gerando PDF",
        description: "Aguarde enquanto o PDF é gerado...",
      });

      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`dashboard-financeiro-${format(new Date(), "dd-MM-yyyy")}.pdf`);

      toast({
        title: "PDF exportado",
        description: "O gráfico foi baixado como PDF.",
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar o PDF.",
        variant: "destructive",
      });
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <p className="font-semibold text-foreground mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium text-[#22c55e]">Faturamento:</span> {formatCurrency(payload[0].payload.faturamento)}
            </p>
            <p className="text-sm">
              <span className="font-medium text-[#ef4444]">Custos:</span> {formatCurrency(payload[0].payload.custo)}
            </p>
            <p className="text-sm">
              <span className="font-medium text-[#0ea5e9]">Lucro:</span> {formatCurrency(payload[0].payload.lucro)}
            </p>
            <p className="text-sm">
              <span className="font-medium text-muted-foreground">Vendas:</span> {payload[0].payload.vendas}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Filtros do Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Produto</label>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products?.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kit</label>
              <Select value={kitFilter} onValueChange={setKitFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os kits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os kits</SelectItem>
                  {kits?.map(kit => (
                    <SelectItem key={kit.id} value={kit.id}>
                      {kit.name} ({kit.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {periodFilter === "custom" && (
            <div className="grid gap-4 md:grid-cols-1">
              <DateRangeFilter
                onDateChange={(from, to) => {
                  setCustomStartDate(from || undefined);
                  setCustomEndDate(to || undefined);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="border-0 shadow-card" ref={chartRef}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Evolução Financeira Diária</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportAsImage}>
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={exportAsPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">Nenhum dado disponível para o período selecionado</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="faturamento" 
                  stroke="#22c55e" 
                  strokeWidth={3}
                  name="Faturamento"
                  dot={{ fill: "#22c55e", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="custo" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  name="Custos"
                  dot={{ fill: "#ef4444", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="#0ea5e9" 
                  strokeWidth={3}
                  name="Lucro Líquido"
                  dot={{ fill: "#0ea5e9", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Ticket Médio
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {formatCurrency(metrics.ticketMedio)}
            </div>
            <p className="text-sm text-muted-foreground">
              Valor médio por venda
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Crescimento do Lucro
            </CardTitle>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              metrics.crescimentoLucro >= 0 ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              <TrendingUp className={`h-5 w-5 ${
                metrics.crescimentoLucro >= 0 ? 'text-success' : 'text-destructive'
              }`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-bold tracking-tight ${
              metrics.crescimentoLucro >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {metrics.crescimentoLucro >= 0 ? '+' : ''}{metrics.crescimentoLucro.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              vs. período anterior
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Margem Média
            </CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Percent className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {metrics.margemMedia.toFixed(1)}%
            </div>
            <p className="text-sm text-muted-foreground">
              Lucro / Faturamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Lucro Acumulado
            </CardTitle>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
              metrics.lucroAcumulado >= 0 ? 'bg-success/10' : 'bg-destructive/10'
            }`}>
              <DollarSign className={`h-5 w-5 ${
                metrics.lucroAcumulado >= 0 ? 'text-success' : 'text-destructive'
              }`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className={`text-3xl font-bold tracking-tight ${
              metrics.lucroAcumulado >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {formatCurrency(metrics.lucroAcumulado)}
            </div>
            <p className="text-sm text-muted-foreground">
              Total do período
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
