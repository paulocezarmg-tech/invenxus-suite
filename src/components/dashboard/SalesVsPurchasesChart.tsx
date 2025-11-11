import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";

export const SalesVsPurchasesChart = () => {
  const { data: organizationId } = useOrganization();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["sales-vs-purchases-chart", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return format(date, "yyyy-MM-dd");
      });

      const { data: financeiro, error } = await supabase
        .from("financeiro")
        .select("tipo, valor, data")
        .eq("organization_id", organizationId)
        .gte("data", format(subDays(new Date(), 30), "yyyy-MM-dd"))
        .order("data", { ascending: true });

      if (error) throw error;

      const groupedData = last30Days.map(date => {
        const dayMovements = financeiro.filter(m => m.data === date);

        const compras = dayMovements
          .filter(m => m.tipo === "entrada")
          .reduce((sum, m) => sum + Number(m.valor), 0);

        const vendas = dayMovements
          .filter(m => m.tipo === "saida")
          .reduce((sum, m) => sum + Number(m.valor), 0);

        return {
          date: format(new Date(date), "dd/MM"),
          compras,
          vendas,
        };
      });

      return groupedData;
    },
    enabled: !!organizationId,
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Vendas vs Compras - Últimos 30 Dias</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            Carregando gráfico...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
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
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="compras" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Compras"
                dot={{ fill: "hsl(var(--destructive))" }}
              />
              <Line 
                type="monotone" 
                dataKey="vendas" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                name="Vendas"
                dot={{ fill: "hsl(var(--success))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
