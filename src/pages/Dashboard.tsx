import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { StockChart } from "@/components/dashboard/StockChart";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Package, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Check user role - get highest privilege role
  const { data: currentUser, isLoading: isLoadingRole } = useQuery({
    queryKey: ["current-user-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesData && rolesData.length > 0) {
        // Determine highest privilege role
        const roleHierarchy = {
          superadmin: 4,
          admin: 3,
          almoxarife: 2,
          auditor: 1,
          operador: 0
        };
        
        const highestRole = rolesData.reduce((highest, current) => {
          const currentLevel = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
          const highestLevel = roleHierarchy[highest as keyof typeof roleHierarchy] || 0;
          return currentLevel > highestLevel ? current.role : highest;
        }, rolesData[0].role);
        
        console.log("Dashboard - User highest role:", highestRole);
        setUserRole(highestRole);
      }
      return user;
    },
  });

  // Listen for realtime changes to user_roles
  useEffect(() => {
    let channel: any;
    
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      channel = supabase
        .channel('user-roles-dashboard')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${data.user.id}`
          },
          () => {
            console.log('User roles changed, refetching...');
            queryClient.invalidateQueries({ queryKey: ["current-user-dashboard"] });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dateFrom, dateTo],
    queryFn: async () => {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("quantity, cost, min_quantity");

      if (productsError) throw productsError;

      let movementsQuery = supabase
        .from("movements")
        .select("type, created_at");

      if (dateFrom && dateTo) {
        movementsQuery = movementsQuery
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      } else {
        movementsQuery = movementsQuery
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      }

      const { data: movements, error: movementsError } = await movementsQuery;

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

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do estoque e movimentações
          </p>
        </div>
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userRole !== "operador" && (
          <KPICard
            title="Valor Total em Estoque"
            value={new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(stats?.totalValue || 0)}
            icon={DollarSign}
            description="Valor total de produtos"
          />
        )}
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
