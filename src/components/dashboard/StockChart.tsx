import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { format, subDays } from "date-fns";
import { TrendingUp, Loader2 } from "lucide-react";

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
    <Card className="border border-border/50 shadow-card hover:shadow-elevated transition-all duration-300">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">Movimentações</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando gráfico...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: 16 }}
                iconType="circle"
              />
              <Area 
                type="monotone" 
                dataKey="entradas" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2.5}
                fill="url(#colorEntradas)"
                name="Entradas"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--background))" }}
              />
              <Area 
                type="monotone" 
                dataKey="saidas" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2.5}
                fill="url(#colorSaidas)"
                name="Saídas"
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--background))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
