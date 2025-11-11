import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { StockChart } from "@/components/dashboard/StockChart";
import { SalesVsPurchasesChart } from "@/components/dashboard/SalesVsPurchasesChart";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Package, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/formatters";
const Dashboard = () => {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const {
    data: organizationId
  } = useOrganization();

  // Get user profile for greeting
  const {
    data: userProfile
  } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return null;
      const {
        data: profile
      } = await supabase.from("profiles").select("name").eq("user_id", user.id).single();
      return profile;
    }
  });

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  // Check user role - get highest privilege role
  const {
    data: currentUser,
    isLoading: isLoadingRole
  } = useQuery({
    queryKey: ["current-user-dashboard"],
    queryFn: async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return null;
      const {
        data: rolesData
      } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
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
    }
  });

  // Listen for realtime changes to user_roles
  useEffect(() => {
    let channel: any;
    supabase.auth.getUser().then(({
      data
    }) => {
      if (!data.user) return;
      channel = supabase.channel('user-roles-dashboard').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_roles',
        filter: `user_id=eq.${data.user.id}`
      }, () => {
        console.log('User roles changed, refetching...');
        queryClient.invalidateQueries({
          queryKey: ["current-user-dashboard"]
        });
      }).subscribe();
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

  // Fetch financial stats
  const { data: financialStats } = useQuery({
    queryKey: ['financial-stats', dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      let query = supabase
        .from('financeiro')
        .select('tipo, valor')
        .eq('organization_id', organizationId);

      if (dateFrom && dateTo) {
        query = query
          .gte('data', dateFrom.toISOString().split('T')[0])
          .lte('data', dateTo.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;

      const entradas = data?.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.valor), 0) || 0;
      const saidas = data?.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + Number(m.valor), 0) || 0;
      const saldo = saidas - entradas;

      return { saldo, entradas, saidas };
    },
    enabled: !!organizationId,
  });

  // Fetch contas a vencer
  const { data: contasAVencer } = useQuery({
    queryKey: ['contas-a-vencer', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 7);

      const { data, error } = await supabase
        .from('contas')
        .select('valor')
        .eq('organization_id', organizationId)
        .eq('status', 'Pendente')
        .gte('data_vencimento', today.toISOString().split('T')[0])
        .lte('data_vencimento', futureDate.toISOString().split('T')[0]);

      if (error) throw error;

      const total = data?.reduce((acc, c) => acc + Number(c.valor), 0) || 0;
      return { count: data?.length || 0, total };
    },
    enabled: !!organizationId,
  });

  const {
    data: stats
  } = useQuery({
    queryKey: ["dashboard-stats", dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return {
        totalValue: 0,
        criticalItems: 0,
        todayMovements: 0,
        zeroStock: 0
      };
      const {
        data: products,
        error: productsError
      } = await supabase.from("products").select("quantity, cost, min_quantity").eq("organization_id", organizationId);
      if (productsError) throw productsError;
      let movementsQuery = supabase.from("movements").select("type, created_at").eq("organization_id", organizationId);
      if (dateFrom && dateTo) {
        movementsQuery = movementsQuery.gte("created_at", dateFrom.toISOString()).lte("created_at", dateTo.toISOString());
      } else {
        movementsQuery = movementsQuery.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      }
      const {
        data: movements,
        error: movementsError
      } = await movementsQuery;
      if (movementsError) throw movementsError;
      const totalValue = products.reduce((sum, p) => sum + Number(p.quantity) * Number(p.cost), 0);
      const criticalItems = products.filter(p => Number(p.quantity) <= Number(p.min_quantity)).length;
      const todayMovements = movements.length;
      const zeroStock = products.filter(p => Number(p.quantity) === 0).length;
      return {
        totalValue,
        criticalItems,
        todayMovements,
        zeroStock
      };
    },
    enabled: !!organizationId
  });
  if (isLoadingRole) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>;
  }
  return <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          {userProfile?.name && <p className="mb-1 text-xl font-semibold">{getGreeting()}, {userProfile.name}! 👋
            </p>}
          <p className="text-muted-foreground">
            Visão geral do estoque e movimentações
          </p>
        </div>
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userRole !== "operador" && <KPICard title="Valor Total em Estoque" value={formatCurrency(stats?.totalValue || 0)} icon={DollarSign} description="Valor total de produtos" />}
        <KPICard title="Itens Críticos" value={stats?.criticalItems || 0} icon={AlertTriangle} description="Abaixo do estoque mínimo" />
        <KPICard title="Movimentações Hoje" value={stats?.todayMovements || 0} icon={TrendingUp} description="Entradas e saídas do dia" />
        <KPICard title="Produtos Sem Estoque" value={stats?.zeroStock || 0} icon={Package} description="Produtos com quantidade zero" />
      </div>

      {/* Financial KPI Cards - Only for admin and superadmin */}
      {userRole && ['admin', 'superadmin'].includes(userRole) && financialStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <KPICard
            title="Saldo Total"
            value={formatCurrency(financialStats.saldo)}
            icon={DollarSign}
            description="No período selecionado"
          />
          <KPICard
            title="Entradas"
            value={formatCurrency(financialStats.entradas)}
            icon={TrendingUp}
            description="Total de entradas"
          />
          <KPICard
            title="Saídas"
            value={formatCurrency(financialStats.saidas)}
            icon={TrendingDown}
            description="Total de saídas"
          />
          {contasAVencer && (
            <KPICard
              title="Contas a Vencer (7 dias)"
              value={`${contasAVencer.count} - ${formatCurrency(contasAVencer.total)}`}
              icon={Clock}
              description="Próximos 7 dias"
            />
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <StockChart />
        <CriticalStock />
      </div>

      {/* Financial Charts - Only for admin and superadmin */}
      {userRole && ['admin', 'superadmin'].includes(userRole) && (
        <SalesVsPurchasesChart />
      )}

      <RecentMovements />
    </div>;
};
export default Dashboard;