import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { StockChart } from "@/components/dashboard/StockChart";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { Package, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("quantity, cost, min_quantity");

      if (productsError) throw productsError;

      const { data: movements, error: movementsError } = await supabase
        .from("movements")
        .select("type, created_at")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (movementsError) throw movementsError;

      const totalValue = products.reduce(
        (sum, p) => sum + Number(p.quantity) * Number(p.cost),
        0
      );

      const criticalItems = products.filter(
        p => Number(p.quantity) <= Number(p.min_quantity)
      ).length;

      const todayMovements = movements.length;

      const zeroStock = products.filter(p => Number(p.quantity) === 0).length;

      return {
        totalValue,
        criticalItems,
        todayMovements,
        zeroStock,
      };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do estoque e movimentações
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Valor Total em Estoque"
          value={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(stats?.totalValue || 0)}
          icon={DollarSign}
          description="Valor total de produtos"
        />
        <KPICard
          title="Itens Críticos"
          value={stats?.criticalItems || 0}
          icon={AlertTriangle}
          description="Abaixo do estoque mínimo"
        />
        <KPICard
          title="Movimentações Hoje"
          value={stats?.todayMovements || 0}
          icon={TrendingUp}
          description="Entradas e saídas do dia"
        />
        <KPICard
          title="Produtos Sem Estoque"
          value={stats?.zeroStock || 0}
          icon={Package}
          description="Produtos com quantidade zero"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <StockChart />
        <CriticalStock />
      </div>

      <RecentMovements />
    </div>
  );
};

export default Dashboard;
