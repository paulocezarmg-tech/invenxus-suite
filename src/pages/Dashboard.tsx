import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { StockChart } from "@/components/dashboard/StockChart";
import { SalesVsPurchasesChart } from "@/components/dashboard/SalesVsPurchasesChart";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Package, DollarSign, AlertTriangle, TrendingUp, TrendingDown, Clock, Brain, Sparkles } from "lucide-react";
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

  // Fetch financial stats based on movements and product prices
  const { data: financialStats } = useQuery({
    queryKey: ['financial-stats', dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return { saldo: 0, entradas: 0, saidas: 0 };

      // Definir período
      let from = dateFrom;
      let to = dateTo;

      // Se o usuário selecionou apenas uma data, usamos o mesmo dia como início e fim
      if (from && !to) {
        to = from;
      }

      if (!from || !to) {
        // Se não tiver filtro, usa o dia atual
        from = new Date();
        from.setHours(0, 0, 0, 0);
        to = new Date(from);
        to.setDate(to.getDate() + 1);
      } else {
        // Garantir início/fim do dia
        from = new Date(from);
        from.setHours(0, 0, 0, 0);
        to = new Date(to);
        to.setHours(23, 59, 59, 999);
      }

      const { data, error } = await supabase
        .from('movements')
        .select('type, quantity, created_at, products(preco_venda, cost, custo_unitario), kits(preco_venda, custos_adicionais)')
        .eq('organization_id', organizationId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());

      if (error) throw error;

      // Total comprado = entradas multiplicando pelo custo
      const entradas = data?.filter(m => m.type === 'IN').reduce((acc, m: any) => {
        const productPrice = m.products?.cost ?? m.products?.custo_unitario ?? 0;
        const kitCost = m.kits?.custos_adicionais
          ? (Array.isArray(m.kits.custos_adicionais)
              ? m.kits.custos_adicionais.reduce((s: number, c: any) => s + Number(c.valor || 0), 0)
              : 0)
          : 0;
        const unitCost = productPrice + kitCost;
        return acc + unitCost * Number(m.quantity || 0);
      }, 0) || 0;

      // Total vendido = saídas multiplicando pelo preço de venda
      const saidas = data?.filter(m => m.type === 'OUT').reduce((acc, m: any) => {
        const salePrice = m.products?.preco_venda ?? m.kits?.preco_venda ?? 0;
        return acc + salePrice * Number(m.quantity || 0);
      }, 0) || 0;

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

      // Sempre buscamos os produtos atuais
      const {
        data: products,
        error: productsError
      } = await supabase
        .from("products")
        .select("id, quantity, cost, min_quantity")
        .eq("organization_id", organizationId);

      if (productsError) throw productsError;

      // Por padrão, o card mostra o valor ATUAL do estoque
      // Se o usuário selecionar um período, calculamos o valor do estoque
      // na data final do filtro, "voltando no tempo" a partir da quantidade atual
      let totalValue = 0;

      // Considera também o caso em que só há uma data selecionada (from)
      const effectiveEndDate = dateTo || dateFrom || null;

      if (!effectiveEndDate) {
        // Sem filtro: usa quantidade atual direto
        totalValue = products.reduce(
          (sum, p) => sum + Number(p.quantity) * Number(p.cost),
          0
        );
      } else {
        const endDate = new Date(effectiveEndDate);
        endDate.setHours(23, 59, 59, 999);

        // Buscar movimentações APÓS a data final, para ajustar o estoque atual
        const { data: movementsAfter, error: movementsError } = await supabase
          .from("movements")
          .select("product_id, type, quantity, created_at")
          .eq("organization_id", organizationId)
          .gt("created_at", endDate.toISOString());

        if (movementsError) throw movementsError;

        // Mapa de ajuste por produto: quanto o estoque mudou DEPOIS da data final
        const adjustments = new Map<string, number>();

        (movementsAfter || []).forEach((m: any) => {
          if (!m.product_id) return; // ignora kits por enquanto
          const current = adjustments.get(m.product_id) || 0;

          // Após a data final:
          // IN aumenta o estoque atual, então precisamos subtrair para voltar no tempo
          // OUT diminui o estoque atual, então somamos para voltar no tempo
          let delta = 0;
          if (m.type === "IN") delta = Number(m.quantity || 0);
          if (m.type === "OUT") delta = -Number(m.quantity || 0);

          adjustments.set(m.product_id, current + delta);
        });

        totalValue = products.reduce((sum, p: any) => {
          const adj = adjustments.get(p.id) || 0;
          const quantityAtEndDate = Number(p.quantity) - adj;
          return sum + quantityAtEndDate * Number(p.cost);
        }, 0);
      }

      // Métricas que SEMPRE usam o estoque atual
      const criticalItems = products.filter(
        (p: any) => Number(p.quantity) <= Number(p.min_quantity)
      ).length;

      // Buscar movimentações de hoje (independente do filtro de data)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const {
        data: todayMovementsData,
        error: todayMovementsError
      } = await supabase
        .from("movements")
        .select("type")
        .eq("organization_id", organizationId)
        .gte("created_at", today.toISOString())
        .lt("created_at", tomorrow.toISOString());

      if (todayMovementsError) throw todayMovementsError;

      const todayMovements = todayMovementsData?.length || 0;
      const zeroStock = products.filter((p: any) => Number(p.quantity) === 0).length;

      return {
        totalValue,
        criticalItems,
        todayMovements,
        zeroStock
      };
    },
    enabled: !!organizationId
  });

  // Buscar previsões de estoque
  const { data: previsoesRisco } = useQuery({
    queryKey: ["previsoes-risco-dashboard", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("previsoes_estoque")
        .select("*")
        .eq("organization_id", organizationId)
        .lte("dias_restantes", 7)
        .not("dias_restantes", "is", null);

      if (error) throw error;
      return data?.length || 0;
    },
    enabled: !!organizationId,
  });

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          </div>
          {userProfile?.name && (
            <p className="text-lg font-medium text-foreground/80">
              {getGreeting()}, <span className="text-primary">{userProfile.name}</span>! 👋
            </p>
          )}
          <p className="text-muted-foreground">
            Visão geral do estoque e movimentações
          </p>
        </div>
        <DateRangeFilter onDateChange={handleDateChange} />
      </div>

      {/* Main KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(userRole === "admin" || userRole === "superadmin") && (
          <KPICard 
            title="Valor Total em Estoque" 
            value={formatCurrency(stats?.totalValue || 0)} 
            icon={DollarSign} 
            description="Valor total de produtos"
            variant="success"
          />
        )}
        <KPICard 
          title="Itens Críticos" 
          value={stats?.criticalItems || 0} 
          icon={AlertTriangle} 
          description="Abaixo do estoque mínimo"
          variant="warning"
        />
        <KPICard 
          title="Movimentações Hoje" 
          value={stats?.todayMovements || 0} 
          icon={TrendingUp} 
          description="Entradas e saídas do dia"
          variant="info"
        />
        <KPICard 
          title="Produtos Sem Estoque" 
          value={stats?.zeroStock || 0} 
          icon={Package} 
          description="Produtos com quantidade zero"
          variant="danger"
        />
      </div>

      {/* Financial KPI Cards - Only for admin and superadmin */}
      {userRole && ['admin', 'superadmin'].includes(userRole) && financialStats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Saldo Total"
            value={formatCurrency(financialStats.saldo)}
            icon={DollarSign}
            description="No período selecionado"
            variant={financialStats.saldo >= 0 ? "success" : "danger"}
          />
          <KPICard
            title="Total Comprado"
            value={formatCurrency(financialStats.entradas)}
            icon={TrendingUp}
            description="Total de compras"
            variant="info"
          />
          <KPICard
            title="Total Vendido"
            value={formatCurrency(financialStats.saidas)}
            icon={TrendingDown}
            description="Total de vendas"
            variant="success"
          />
          {contasAVencer && (
            <KPICard
              title="Contas a Vencer (7 dias)"
              value={`${contasAVencer.count} - ${formatCurrency(contasAVencer.total)}`}
              icon={Clock}
              description="Próximos 7 dias"
              variant="warning"
            />
          )}
        </div>
      )}

      {/* Previsão de Estoque Card - Para todos os usuários */}
      {previsoesRisco !== undefined && previsoesRisco > 0 && (
        <div className="grid gap-4">
          <KPICard
            title="Produtos em Risco de Ruptura"
            value={previsoesRisco}
            icon={Brain}
            description="Menos de 7 dias de estoque (IA)"
            variant="warning"
          />
        </div>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StockChart />
        <CriticalStock />
      </div>

      {/* Financial Charts - Only for admin and superadmin */}
      {userRole && ['admin', 'superadmin'].includes(userRole) && (
        <SalesVsPurchasesChart />
      )}

      <RecentMovements />
    </div>
  );
};

export default Dashboard;
