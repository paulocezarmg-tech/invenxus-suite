import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinanceiroItem {
  id: string;
  tipo: string;
  valor: number;
  custo_total: number | null;
  lucro_liquido: number | null;
  categoria: string | null;
  data: string;
  descricao: string;
}

interface GraficosAvancadosProps {
  data: FinanceiroItem[];
  previousPeriodData?: FinanceiroItem[];
}

const COLORS = [
  "hsl(142, 76%, 36%)", // success
  "hsl(0, 84%, 60%)",   // destructive
  "hsl(217, 91%, 60%)", // primary
  "hsl(38, 92%, 50%)",  // amber
  "hsl(280, 87%, 53%)", // purple
  "hsl(173, 58%, 39%)", // teal
];

const CATEGORIAS = [
  "Operacional",
  "Marketing",
  "RH",
  "Logística",
  "Infraestrutura",
  "Outros"
];

export const GraficosAvancados = ({ data, previousPeriodData }: GraficosAvancadosProps) => {
  // Dados por categoria
  const categoriaData = useMemo(() => {
    const categoryMap: Record<string, { valor: number; count: number }> = {};
    
    data.forEach(item => {
      const cat = item.categoria || "Outros";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { valor: 0, count: 0 };
      }
      categoryMap[cat].valor += Number(item.valor || 0);
      categoryMap[cat].count += 1;
    });

    return Object.entries(categoryMap)
      .map(([name, values]) => ({
        name,
        value: values.valor,
        count: values.count,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // Dados comparativos (período atual vs anterior)
  const comparativoData = useMemo(() => {
    const currentByMonth: Record<string, { faturamento: number; custo: number; lucro: number }> = {};
    const previousByMonth: Record<string, { faturamento: number; custo: number; lucro: number }> = {};

    data.forEach(item => {
      const monthKey = format(parseISO(item.data), "MMM", { locale: ptBR });
      if (!currentByMonth[monthKey]) {
        currentByMonth[monthKey] = { faturamento: 0, custo: 0, lucro: 0 };
      }
      if (item.tipo === "saida") {
        currentByMonth[monthKey].faturamento += Number(item.valor || 0);
        currentByMonth[monthKey].custo += Number(item.custo_total || 0);
        currentByMonth[monthKey].lucro += Number(item.lucro_liquido || 0);
      }
    });

    previousPeriodData?.forEach(item => {
      const monthKey = format(parseISO(item.data), "MMM", { locale: ptBR });
      if (!previousByMonth[monthKey]) {
        previousByMonth[monthKey] = { faturamento: 0, custo: 0, lucro: 0 };
      }
      if (item.tipo === "saida") {
        previousByMonth[monthKey].faturamento += Number(item.valor || 0);
        previousByMonth[monthKey].custo += Number(item.custo_total || 0);
        previousByMonth[monthKey].lucro += Number(item.lucro_liquido || 0);
      }
    });

    // Calcular totais
    const currentTotal = Object.values(currentByMonth).reduce(
      (acc, val) => ({
        faturamento: acc.faturamento + val.faturamento,
        custo: acc.custo + val.custo,
        lucro: acc.lucro + val.lucro,
      }),
      { faturamento: 0, custo: 0, lucro: 0 }
    );

    const previousTotal = Object.values(previousByMonth).reduce(
      (acc, val) => ({
        faturamento: acc.faturamento + val.faturamento,
        custo: acc.custo + val.custo,
        lucro: acc.lucro + val.lucro,
      }),
      { faturamento: 0, custo: 0, lucro: 0 }
    );

    return [
      {
        metrica: "Faturamento",
        atual: currentTotal.faturamento,
        anterior: previousTotal.faturamento,
        variacao: previousTotal.faturamento > 0 
          ? ((currentTotal.faturamento - previousTotal.faturamento) / previousTotal.faturamento) * 100 
          : 0
      },
      {
        metrica: "Custos",
        atual: currentTotal.custo,
        anterior: previousTotal.custo,
        variacao: previousTotal.custo > 0 
          ? ((currentTotal.custo - previousTotal.custo) / previousTotal.custo) * 100 
          : 0
      },
      {
        metrica: "Lucro",
        atual: currentTotal.lucro,
        anterior: previousTotal.lucro,
        variacao: previousTotal.lucro > 0 
          ? ((currentTotal.lucro - previousTotal.lucro) / previousTotal.lucro) * 100 
          : 0
      },
    ];
  }, [data, previousPeriodData]);

  // Evolução mensal
  const evolucaoMensal = useMemo(() => {
    const monthlyData: Record<string, { faturamento: number; custo: number; lucro: number; vendas: number }> = {};

    data.forEach(item => {
      const monthKey = format(parseISO(item.data), "MMM/yy", { locale: ptBR });
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { faturamento: 0, custo: 0, lucro: 0, vendas: 0 };
      }
      if (item.tipo === "saida") {
        monthlyData[monthKey].faturamento += Number(item.valor || 0);
        monthlyData[monthKey].custo += Number(item.custo_total || 0);
        monthlyData[monthKey].lucro += Number(item.lucro_liquido || 0);
        monthlyData[monthKey].vendas += 1;
      }
    });

    return Object.entries(monthlyData)
      .map(([mes, values]) => ({ mes, ...values }))
      .reverse();
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm">{payload[0].name || payload[0].payload.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ name, percent }: any) => {
    return `${name} (${(percent * 100).toFixed(0)}%)`;
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Pizza por Categoria */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriaData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoriaData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoriaData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Comparativo de Períodos */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Comparativo de Períodos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativoData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  type="category" 
                  dataKey="metrica" 
                  width={80}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="anterior" name="Período Anterior" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="atual" name="Período Atual" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Evolução Mensal */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          {evolucaoMensal.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              Nenhum dado disponível
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "faturamento" ? "Faturamento" : 
                    name === "custo" ? "Custos" : "Lucro"
                  ]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend 
                  formatter={(value) => 
                    value === "faturamento" ? "Faturamento" : 
                    value === "custo" ? "Custos" : "Lucro"
                  }
                />
                <Line 
                  type="monotone" 
                  dataKey="faturamento" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="custo" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: "#ef4444", r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="#0ea5e9" 
                  strokeWidth={2}
                  dot={{ fill: "#0ea5e9", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Cards de Variação */}
      <div className="grid gap-4 md:grid-cols-3">
        {comparativoData.map((item, index) => (
          <Card key={index} className="border-0 shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.metrica}</p>
                  <p className="text-2xl font-bold">{formatCurrency(item.atual)}</p>
                </div>
                <div className={`text-right ${item.variacao >= 0 ? 'text-success' : 'text-destructive'}`}>
                  <p className="text-lg font-semibold">
                    {item.variacao >= 0 ? '+' : ''}{item.variacao.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">vs período anterior</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export { CATEGORIAS };
