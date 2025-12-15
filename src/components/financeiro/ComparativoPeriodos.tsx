import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { useOrganization } from "@/hooks/useOrganization";
import { TrendingUp, TrendingDown, Minus, ArrowUpDown } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, subYears, startOfYear, endOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

type ComparacaoTipo = "mes-anterior" | "ano-anterior" | "trimestre-anterior";

export const ComparativoPeriodos = () => {
  const { data: organizationId } = useOrganization();
  const [comparacao, setComparacao] = useState<ComparacaoTipo>("mes-anterior");

  const { startAtual, endAtual, startAnterior, endAnterior, labelAtual, labelAnterior } = useMemo(() => {
    const now = new Date();
    
    switch (comparacao) {
      case "mes-anterior": {
        const mesAtual = startOfMonth(now);
        const mesAnterior = startOfMonth(subMonths(now, 1));
        return {
          startAtual: format(mesAtual, "yyyy-MM-dd"),
          endAtual: format(endOfMonth(now), "yyyy-MM-dd"),
          startAnterior: format(mesAnterior, "yyyy-MM-dd"),
          endAnterior: format(endOfMonth(mesAnterior), "yyyy-MM-dd"),
          labelAtual: format(now, "MMMM/yyyy", { locale: ptBR }),
          labelAnterior: format(subMonths(now, 1), "MMMM/yyyy", { locale: ptBR }),
        };
      }
      case "ano-anterior": {
        const anoAtual = startOfYear(now);
        const anoAnterior = startOfYear(subYears(now, 1));
        return {
          startAtual: format(anoAtual, "yyyy-MM-dd"),
          endAtual: format(endOfYear(now), "yyyy-MM-dd"),
          startAnterior: format(anoAnterior, "yyyy-MM-dd"),
          endAnterior: format(endOfYear(anoAnterior), "yyyy-MM-dd"),
          labelAtual: format(now, "yyyy"),
          labelAnterior: format(subYears(now, 1), "yyyy"),
        };
      }
      case "trimestre-anterior": {
        const mesAtual = startOfMonth(now);
        const tresMesesAtras = startOfMonth(subMonths(now, 3));
        const seisMesesAtras = startOfMonth(subMonths(now, 6));
        return {
          startAtual: format(tresMesesAtras, "yyyy-MM-dd"),
          endAtual: format(endOfMonth(now), "yyyy-MM-dd"),
          startAnterior: format(seisMesesAtras, "yyyy-MM-dd"),
          endAnterior: format(endOfMonth(subMonths(now, 3)), "yyyy-MM-dd"),
          labelAtual: `${format(tresMesesAtras, "MMM", { locale: ptBR })} - ${format(now, "MMM/yy", { locale: ptBR })}`,
          labelAnterior: `${format(seisMesesAtras, "MMM", { locale: ptBR })} - ${format(subMonths(now, 3), "MMM/yy", { locale: ptBR })}`,
        };
      }
      default:
        return {
          startAtual: format(startOfMonth(now), "yyyy-MM-dd"),
          endAtual: format(endOfMonth(now), "yyyy-MM-dd"),
          startAnterior: format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
          endAnterior: format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd"),
          labelAtual: "Atual",
          labelAnterior: "Anterior",
        };
    }
  }, [comparacao]);

  const { data: dadosAtual } = useQuery({
    queryKey: ["comparativo-atual", organizationId, startAtual, endAtual],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("data", startAtual)
        .lte("data", endAtual);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: dadosAnterior } = useQuery({
    queryKey: ["comparativo-anterior", organizationId, startAnterior, endAnterior],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("data", startAnterior)
        .lte("data", endAnterior);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const metricas = useMemo(() => {
    const calcularMetricas = (dados: any[] | undefined) => {
      if (!dados) return { faturamento: 0, custos: 0, lucro: 0, vendas: 0, margem: 0 };
      
      const vendas = dados.filter(d => d.tipo === "saida");
      const faturamento = vendas.reduce((sum, d) => sum + Number(d.valor || 0), 0);
      const custos = dados.reduce((sum, d) => sum + Number(d.custo_total || 0), 0);
      const lucro = faturamento - custos;
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

      return { faturamento, custos, lucro, vendas: vendas.length, margem };
    };

    const atual = calcularMetricas(dadosAtual);
    const anterior = calcularMetricas(dadosAnterior);

    const calcVariacao = (atualVal: number, anteriorVal: number) => {
      if (anteriorVal === 0) return atualVal > 0 ? 100 : 0;
      return ((atualVal - anteriorVal) / anteriorVal) * 100;
    };

    return [
      {
        metrica: "Faturamento",
        atual: atual.faturamento,
        anterior: anterior.faturamento,
        variacao: calcVariacao(atual.faturamento, anterior.faturamento),
        formato: "currency"
      },
      {
        metrica: "Custos",
        atual: atual.custos,
        anterior: anterior.custos,
        variacao: calcVariacao(atual.custos, anterior.custos),
        formato: "currency",
        inverso: true
      },
      {
        metrica: "Lucro Líquido",
        atual: atual.lucro,
        anterior: anterior.lucro,
        variacao: calcVariacao(atual.lucro, anterior.lucro),
        formato: "currency"
      },
      {
        metrica: "Vendas",
        atual: atual.vendas,
        anterior: anterior.vendas,
        variacao: calcVariacao(atual.vendas, anterior.vendas),
        formato: "number"
      },
      {
        metrica: "Margem",
        atual: atual.margem,
        anterior: anterior.margem,
        variacao: atual.margem - anterior.margem,
        formato: "percent"
      },
    ];
  }, [dadosAtual, dadosAnterior]);

  const chartData = metricas.filter(m => m.formato === "currency").map(m => ({
    name: m.metrica,
    [labelAnterior]: m.anterior,
    [labelAtual]: m.atual,
  }));

  const formatValue = (value: number, formato: string) => {
    switch (formato) {
      case "currency": return formatCurrency(value);
      case "percent": return `${value.toFixed(1)}%`;
      default: return value.toString();
    }
  };

  const getVariacaoIcon = (variacao: number, inverso?: boolean) => {
    const isPositive = inverso ? variacao < 0 : variacao > 0;
    const isNegative = inverso ? variacao > 0 : variacao < 0;
    
    if (isPositive) return <TrendingUp className="h-4 w-4 text-success" />;
    if (isNegative) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getVariacaoColor = (variacao: number, inverso?: boolean) => {
    const isPositive = inverso ? variacao < 0 : variacao > 0;
    const isNegative = inverso ? variacao > 0 : variacao < 0;
    
    if (isPositive) return "text-success";
    if (isNegative) return "text-destructive";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Comparativo de Períodos
          </h2>
          <p className="text-sm text-muted-foreground">
            Compare o desempenho entre diferentes períodos
          </p>
        </div>
        <Select value={comparacao} onValueChange={(value: ComparacaoTipo) => setComparacao(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes-anterior">Mês vs Mês Anterior</SelectItem>
            <SelectItem value="trimestre-anterior">Trimestre vs Anterior</SelectItem>
            <SelectItem value="ano-anterior">Ano vs Ano Anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {metricas.map((item, index) => (
          <Card key={index} className="border-0 shadow-card">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{item.metrica}</p>
                {getVariacaoIcon(item.variacao, item.inverso)}
              </div>
              <p className="text-xl font-bold">{formatValue(item.atual, item.formato)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-sm font-medium ${getVariacaoColor(item.variacao, item.inverso)}`}>
                  {item.variacao >= 0 ? "+" : ""}{item.variacao.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs anterior</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico Comparativo */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {labelAnterior} vs {labelAtual}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar dataKey={labelAnterior} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              <Bar dataKey={labelAtual} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">{labelAnterior}</TableHead>
                <TableHead className="text-right">{labelAtual}</TableHead>
                <TableHead className="text-right">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricas.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.metrica}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatValue(item.anterior, item.formato)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatValue(item.atual, item.formato)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {getVariacaoIcon(item.variacao, item.inverso)}
                      <span className={getVariacaoColor(item.variacao, item.inverso)}>
                        {item.variacao >= 0 ? "+" : ""}{item.variacao.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
