import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";

export const StockChart = () => {
  const { data: chartData, isLoading } = useQuery({
    queryKey: ["stock-chart"],
    queryFn: async () => {
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = subDays(new Date(), 29 - i);
        return format(date, "yyyy-MM-dd");
      });

      const { data: movements, error } = await supabase
        .from("movements")
        .select("type, quantity, created_at")
        .gte("created_at", format(subDays(new Date(), 30), "yyyy-MM-dd"))
        .order("created_at", { ascending: true });

      if (error) throw error;

      const groupedData = last30Days.map(date => {
        const dayMovements = movements.filter(m => 
          format(new Date(m.created_at), "yyyy-MM-dd") === date
        );

        const entradas = dayMovements
          .filter(m => m.type === "IN")
          .reduce((sum, m) => sum + Number(m.quantity), 0);

        const saidas = dayMovements
          .filter(m => m.type === "OUT")
          .reduce((sum, m) => sum + Number(m.quantity), 0);

        return {
          date: format(new Date(date), "dd/MM"),
          entradas,
          saidas,
        };
      });

      return groupedData;
    },
  });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Movimentações - Últimos 30 Dias</CardTitle>
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
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="entradas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name="Entradas"
                dot={{ fill: "hsl(var(--primary))" }}
              />
              <Line 
                type="monotone" 
                dataKey="saidas" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name="Saídas"
                dot={{ fill: "hsl(var(--destructive))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
