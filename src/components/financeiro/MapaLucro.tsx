import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { format, subDays, startOfMonth } from "date-fns";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { TrendingUp, TrendingDown, DollarSign, Target, Sparkles, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { IAPrecoIdealDialog } from "./IAPrecoIdealDialog";

type ClassificationType = "Estrela" | "Estável" | "Sombra" | "Problemático";

interface ProductPerformance {
  id: string;
  name: string;
  type: "produto" | "kit";
  faturamento: number;
  lucro: number;
  margem: number;
  quantidade: number;
  ticketMedio: number;
  classificacao: ClassificationType;
  color: string;
  dailyData: Array<{ date: string; lucro: number; vendas: number }>;
}

export function MapaLucro() {
  const [period, setPeriod] = useState("30");
  const [tipo, setTipo] = useState<"produtos" | "kits" | "ambos">("ambos");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<ProductPerformance | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [priceRecommendation, setPriceRecommendation] = useState<any>(null);
  const [newPrice, setNewPrice] = useState<string>("");
  const [isApplyingPrice, setIsApplyingPrice] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedPriceItem, setSelectedPriceItem] = useState<ProductPerformance | null>(null);

  const dateRange = useMemo(() => {
    if (startDate && endDate) {
      return { start: format(startDate, "yyyy-MM-dd"), end: format(endDate, "yyyy-MM-dd") };
    }
    const end = new Date();
    let start: Date;
    switch (period) {
      case "7":
        start = subDays(end, 7);
        break;
      case "15":
        start = subDays(end, 15);
        break;
      case "30":
        start = subDays(end, 30);
        break;
      case "mes":
        start = startOfMonth(end);
        break;
      default:
        start = subDays(end, 30);
    }
    return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
  }, [period, startDate, endDate]);

  const { data: financialData, isLoading } = useQuery({
    queryKey: ["mapa-lucro", dateRange, tipo],
    queryFn: async () => {
      let query = supabase
        .from("financeiro")
        .select("*")
        .eq("tipo", "venda")
        .gte("data", dateRange.start)
        .lte("data", dateRange.end);

      const { data, error } = await query;
      if (error) throw error;
      
      console.log("MapaLucro - Dados financeiros encontrados:", data?.length || 0);
      console.log("MapaLucro - Período:", dateRange);
      
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: kits } = useQuery({
    queryKey: ["kits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kits").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const performanceData = useMemo(() => {
    if (!financialData || !products || !kits) return [];

    console.log("MapaLucro - Processando dados:", {
      financialData: financialData.length,
      products: products.length,
      kits: kits.length
    });

    const itemsMap = new Map<string, ProductPerformance>();

    financialData.forEach((mov) => {
      if (!mov.produto_id) {
        console.log("MapaLucro - Movimento sem produto_id:", mov);
        return;
      }

      const isKit = mov.descricao?.includes("Kit:") || false;
      if (tipo === "produtos" && isKit) return;
      if (tipo === "kits" && !isKit) return;

      const itemId = mov.produto_id;
      const itemName = isKit
        ? kits.find((k) => k.id === itemId)?.name || "Kit desconhecido"
        : products.find((p) => p.id === itemId)?.name || "Produto desconhecido";

      if (!itemsMap.has(itemId)) {
        itemsMap.set(itemId, {
          id: itemId,
          name: itemName,
          type: isKit ? "kit" : "produto",
          faturamento: 0,
          lucro: 0,
          margem: 0,
          quantidade: 0,
          ticketMedio: 0,
          classificacao: "Estável",
          color: "#0ea5e9",
          dailyData: [],
        });
      }

      const item = itemsMap.get(itemId)!;
      const lucro = mov.lucro_liquido || 0;
      const faturamento = mov.preco_venda || 0;
      const quantidade = mov.quantidade || 0;

      item.faturamento += faturamento;
      item.lucro += lucro;
      item.quantidade += quantidade;

      const existingDay = item.dailyData.find((d) => d.date === mov.data);
      if (existingDay) {
        existingDay.lucro += lucro;
        existingDay.vendas += quantidade;
      } else {
        item.dailyData.push({
          date: mov.data,
          lucro: lucro,
          vendas: quantidade,
        });
      }
    });

    const items = Array.from(itemsMap.values());

    items.forEach((item) => {
      item.margem = item.faturamento > 0 ? (item.lucro / item.faturamento) * 100 : 0;
      item.ticketMedio = item.quantidade > 0 ? item.faturamento / item.quantidade : 0;
    });

    const avgLucro = items.reduce((sum, i) => sum + i.lucro, 0) / items.length;
    const avgQuantidade = items.reduce((sum, i) => sum + i.quantidade, 0) / items.length;
    const sortedByLucro = [...items].sort((a, b) => b.lucro - a.lucro);
    const sortedByQuantidade = [...items].sort((a, b) => b.quantidade - a.quantidade);

    items.forEach((item) => {
      const lucroRank = sortedByLucro.findIndex((i) => i.id === item.id);
      const quantidadeRank = sortedByQuantidade.findIndex((i) => i.id === item.id);
      const topLucro = lucroRank < items.length * 0.25;
      const topQuantidade = quantidadeRank < items.length * 0.25;

      if (topLucro && topQuantidade) {
        item.classificacao = "Estrela";
        item.color = "#22c55e";
      } else if (item.lucro < 0 || (item.lucro < avgLucro * 0.5 && item.margem < 10)) {
        item.classificacao = "Problemático";
        item.color = "#ef4444";
      } else if (item.faturamento > avgLucro && item.margem < 15) {
        item.classificacao = "Sombra";
        item.color = "#eab308";
      } else {
        item.classificacao = "Estável";
        item.color = "#0ea5e9";
      }
    });

    return items.sort((a, b) => b.lucro - a.lucro);
  }, [financialData, products, kits, tipo]);

  const metrics = useMemo(() => {
    if (performanceData.length === 0) {
      return {
        lucroTotal: 0,
        maisLucrativo: null,
        piorMargem: null,
        ticketMedio: 0,
      };
    }

    const lucroTotal = performanceData.reduce((sum, item) => sum + item.lucro, 0);
    const maisLucrativo = performanceData[0];
    const piorMargem = [...performanceData].sort((a, b) => a.margem - b.margem)[0];
    const faturamentoTotal = performanceData.reduce((sum, item) => sum + item.faturamento, 0);
    const quantidadeTotal = performanceData.reduce((sum, item) => sum + item.quantidade, 0);
    const ticketMedio = quantidadeTotal > 0 ? faturamentoTotal / quantidadeTotal : 0;

    return { lucroTotal, maisLucrativo, piorMargem, ticketMedio };
  }, [performanceData]);

  const chartData = useMemo(() => {
    return performanceData.slice(0, 10).map((item) => ({
      name: item.name.length > 25 ? item.name.substring(0, 25) + "..." : item.name,
      lucro: item.lucro,
      color: item.color,
    }));
  }, [performanceData]);

  const handleItemClick = (item: ProductPerformance) => {
    setSelectedItem(item);
    setPriceRecommendation(null);
    setNewPrice("");
    setIsDetailOpen(true);
  };

  const handleCalculateIdealPrice = async () => {
    if (!selectedItem) return;

    setIsCalculatingPrice(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Você precisa estar autenticado");
        return;
      }

      const custoMedio = selectedItem.faturamento > 0 
        ? (selectedItem.faturamento - selectedItem.lucro) / selectedItem.quantidade 
        : 0;

      const { data, error } = await supabase.functions.invoke("calcular-preco-ideal", {
        body: {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          itemType: selectedItem.type,
          currentPrice: selectedItem.ticketMedio,
          currentCost: custoMedio,
          currentMargin: selectedItem.margem,
          salesHistory: selectedItem.dailyData,
        },
      });

      if (error) throw error;

      setPriceRecommendation(data);
      setNewPrice(data.preco_recomendado.toFixed(2));
      toast.success("Preço ideal calculado com sucesso!");
    } catch (error) {
      console.error("Erro ao calcular preço ideal:", error);
      toast.error("Erro ao calcular preço ideal. Tente novamente.");
    } finally {
      setIsCalculatingPrice(false);
    }
  };

  const handleApplyPrice = async () => {
    if (!selectedItem || !newPrice || !priceRecommendation) return;

    setIsApplyingPrice(true);
    try {
      const priceValue = parseFloat(newPrice);
      if (isNaN(priceValue) || priceValue <= 0) {
        toast.error("Preço inválido");
        return;
      }

      const table = selectedItem.type === "kit" ? "kits" : "products";
      const { error: updateError } = await supabase
        .from(table)
        .update({ preco_venda: priceValue })
        .eq("id", selectedItem.id);

      if (updateError) throw updateError;

      if (priceRecommendation.recomendacao_id) {
        await supabase
          .from("recomendacoes_preco")
          .update({ 
            aplicado: true, 
            data_aplicacao: new Date().toISOString() 
          })
          .eq("id", priceRecommendation.recomendacao_id);
      }

      toast.success(`Preço atualizado para ${formatCurrency(priceValue)}!`);
      setIsDetailOpen(false);
      setPriceRecommendation(null);
    } catch (error) {
      console.error("Erro ao aplicar preço:", error);
      toast.error("Erro ao aplicar preço. Tente novamente.");
    } finally {
      setIsApplyingPrice(false);
    }
  };

  const getClassificationBadge = (classificacao: ClassificationType) => {
    const colors = {
      Estrela: "bg-[#22c55e] text-white",
      Estável: "bg-[#0ea5e9] text-white",
      Sombra: "bg-[#eab308] text-white",
      Problemático: "bg-[#ef4444] text-white",
    };
    return <Badge className={colors[classificacao]}>{classificacao}</Badge>;
  };

  if (isLoading) {
    return <div className="p-6">Carregando mapa de lucro...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="15">Últimos 15 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="mes">Mês atual</SelectItem>
            <SelectItem value="custom">Período personalizado</SelectItem>
          </SelectContent>
        </Select>

        {period === "custom" && (
          <DateRangeFilter
            onDateChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        )}

        <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ambos">Produtos e Kits</SelectItem>
            <SelectItem value="produtos">Apenas Produtos</SelectItem>
            <SelectItem value="kits">Apenas Kits</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.lucroTotal)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mais Lucrativo</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{metrics.maisLucrativo?.name || "-"}</div>
            <div className="text-xs text-muted-foreground">
              {metrics.maisLucrativo ? formatCurrency(metrics.maisLucrativo.lucro) : "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pior Margem</CardTitle>
            <TrendingDown className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{metrics.piorMargem?.name || "-"}</div>
            <div className="text-xs text-muted-foreground">
              {metrics.piorMargem ? `${metrics.piorMargem.margem.toFixed(1)}%` : "-"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.ticketMedio)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 - Lucro por Produto/Kit</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
              <YAxis type="category" dataKey="name" width={150} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Bar dataKey="lucro" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto/Kit</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Lucro</TableHead>
                <TableHead className="text-right">Margem %</TableHead>
                <TableHead className="text-right">Qtd. Vendida</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performanceData.map((item) => (
                <TableRow key={item.id} className="hover:bg-muted/50">
                  <TableCell 
                    className="font-medium cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.name}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {formatCurrency(item.faturamento)}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {formatCurrency(item.lucro)}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.margem.toFixed(1)}%
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {item.quantidade}
                  </TableCell>
                  <TableCell 
                    className="text-right cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {formatCurrency(item.ticketMedio)}
                  </TableCell>
                  <TableCell 
                    className="cursor-pointer"
                    onClick={() => handleItemClick(item)}
                  >
                    {getClassificationBadge(item.classificacao)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPriceItem(item);
                        setPriceDialogOpen(true);
                      }}
                      className="gap-1"
                    >
                      <Zap className="h-3 w-3" />
                      Calcular Preço Ideal
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Lucro Total</div>
                    <div className="text-2xl font-bold">{formatCurrency(selectedItem.lucro)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-muted-foreground">Margem</div>
                    <div className="text-2xl font-bold">{selectedItem.margem.toFixed(1)}%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Lucro por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={selectedItem.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), "dd/MM")} />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                        }}
                      />
                      <Bar dataKey="lucro" fill={selectedItem.color} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Sugestão de Preço com IA</CardTitle>
                  <Button
                    onClick={handleCalculateIdealPrice}
                    disabled={isCalculatingPrice}
                    size="sm"
                    className="gap-2"
                  >
                    {isCalculatingPrice ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Calcular Preço Ideal
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {!priceRecommendation ? (
                    <p className="text-sm text-muted-foreground">
                      Clique no botão acima para que a IA analise o histórico de vendas e sugira o preço ideal para
                      maximizar lucro mantendo boa rotatividade.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground">Preço Atual</div>
                            <div className="text-xl font-bold">{formatCurrency(selectedItem.ticketMedio)}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground">Preço Recomendado</div>
                            <div className="text-xl font-bold text-primary">
                              {formatCurrency(priceRecommendation.preco_recomendado)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {priceRecommendation.lucro_potencial && (
                        <Card className="bg-muted/50">
                          <CardContent className="pt-6">
                            <div className="text-sm text-muted-foreground">Lucro Potencial Estimado</div>
                            <div className="text-xl font-bold text-success">
                              {formatCurrency(priceRecommendation.lucro_potencial)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Impacto na demanda: {priceRecommendation.impacto_demanda}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-sm">{priceRecommendation.analise_completa}</div>
                      </div>

                      <div className="space-y-3 pt-4 border-t">
                        <Label htmlFor="newPrice">Aplicar novo preço</Label>
                        <div className="flex gap-2">
                          <Input
                            id="newPrice"
                            type="number"
                            step="0.01"
                            min="0"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value)}
                            placeholder="0.00"
                            className="flex-1"
                          />
                          <Button onClick={handleApplyPrice} disabled={isApplyingPrice || !newPrice}>
                            {isApplyingPrice ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Aplicando...
                              </>
                            ) : (
                              "Aplicar Preço"
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Este preço será atualizado no cadastro do {selectedItem.type === "kit" ? "kit" : "produto"}.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recomendação de Desempenho</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedItem.classificacao === "Estrela" && (
                    <p className="text-sm">
                      🌟 Este é um produto estrela! Continue investindo em marketing e mantenha o estoque sempre
                      disponível. Considere aumentar levemente o preço para maximizar a margem.
                    </p>
                  )}
                  {selectedItem.classificacao === "Estável" && (
                    <p className="text-sm">
                      ✅ Produto com desempenho consistente. Mantenha o equilíbrio entre preço e volume. Avalie
                      oportunidades de cross-sell com produtos estrela.
                    </p>
                  )}
                  {selectedItem.classificacao === "Sombra" && (
                    <p className="text-sm">
                      ⚠️ Alto faturamento mas margem baixa. Revise os custos envolvidos (fornecedor, frete, impostos) e
                      considere reajuste de preço ou substituição por alternativa mais rentável.
                    </p>
                  )}
                  {selectedItem.classificacao === "Problemático" && (
                    <p className="text-sm">
                      🚨 Produto com baixo desempenho. Considere descontinuar ou criar promoção para liquidar estoque.
                      Reavalie custos e precificação urgentemente.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de cálculo de preço ideal */}
      {selectedPriceItem && (
        <IAPrecoIdealDialog
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          itemId={selectedPriceItem.id}
          itemName={selectedPriceItem.name}
          itemType={selectedPriceItem.type}
          currentPrice={selectedPriceItem.ticketMedio}
          currentCost={selectedPriceItem.faturamento - selectedPriceItem.lucro}
          currentMargin={selectedPriceItem.margem}
          onPriceApplied={() => {
            toast.success("Dados atualizados!");
          }}
        />
      )}
    </div>
  );
}
