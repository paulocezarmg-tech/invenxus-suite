import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { RecentMovements } from "@/components/dashboard/RecentMovements";
import { StockChart } from "@/components/dashboard/StockChart";
import { CriticalStock } from "@/components/dashboard/CriticalStock";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Package, DollarSign, AlertTriangle, TrendingUp } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { motion } from "framer-motion";

// Tipagem para perfil do usuário
interface UserProfile {
  name: string;
  gender?: "M" | "F";
}

// 🔹 Função para retornar saudação e emoji conforme horário
function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia", emoji: "☀️" };
  if (hour < 18) return { text: "Boa tarde", emoji: "🌇" };
  return { text: "Boa noite", emoji: "🌙" };
}

// 🔹 Função para ajustar nome e gênero
function formatUserName(name = "", gender: "M" | "F" = "M") {
  const formattedName =
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  const greetingEnding = gender === "F" ? "Seja bem-vinda" : "Seja bem-vindo";
  return { formattedName, greetingEnding };
}

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { data: organizationId } = useOrganization();

  // Buscar perfil do usuário
  const { data: userProfile } = useQuery<UserProfile | null>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, gender")
        .eq("user_id", user.id)
        .single();
      return profile as UserProfile;
    },
  });

  // Buscar o papel (role) do usuário
  const { isLoading: isLoadingRole } = useQuery({
    queryKey: ["current-user-dashboard"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesData && rolesData.length > 0) {
        const roleHierarchy: Record<string, number> = {
          superadmin: 4,
          admin: 3,
          almoxarife: 2,
          auditor: 1,
          operador: 0,
        };
        const highestRole = rolesData.reduce((highest, current) => {
          const currentLevel =
            roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
          const highestLevel =
            roleHierarchy[highest as keyof typeof roleHierarchy] || 0;
          return currentLevel > highestLevel ? current.role : highest;
        }, rolesData[0].role);
        console.log("Dashboard - User highest role:", highestRole);
        setUserRole(highestRole);
      }
      return user;
    },
  });

  // Atualizar caso o papel do usuário mude
  useEffect(() => {
    let channel: any;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      channel = supabase
        .channel("user-roles-dashboard")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${data.user.id}`,
          },
          () => {
            console.log("User roles changed, refetching...");
            queryClient.invalidateQueries({
              queryKey: ["current-user-dashboard"],
            });
          }
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filtro de data
  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  };

  // Buscar dados do dashboard
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId)
        return {
          totalValue: 0,
          criticalItems: 0,
          todayMovements: 0,
          zeroStock: 0,
        };

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("quantity, cost, min_quantity")
        .eq("organization_id", organizationId);
      if (productsError) throw productsError;

      let movementsQuery = supabase
        .from("movements")
        .select("type, created_at")
        .eq("organization_id", organizationId);

      if (dateFrom && dateTo) {
        movementsQuery = movementsQuery
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      } else {
        movementsQuery = movementsQuery.gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        );
      }

      const { data: movements, error: movementsError } = await movementsQuery;
      if (movementsError) throw movementsError;

      const totalValue = products.reduce(
        (sum, p) => sum + Number(p.quantity) * Number(p.cost),
        0
      );
      const criticalItems = products.filter(
        (p) => Number(p.quantity) <= Number(p.min_quantity)
      ).length;
      const todayMovements = movements.length;
      const zeroStock = products.filter(
        (p) => Number(p.quantity) === 0
      ).length;

      return {
        totalValue,
        criticalItems,
        todayMovements,
        zeroStock,
      };
    },
    enabled: !!organizationId,
  });

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  // Saudação personalizada
  const { text, emoji } = getGreeting();
  const { formattedName, greetingEnding } = formatUserName(
    userProfile?.name || "Usuário",
    userProfile?.gender || "M"
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>

          {/* Saudação animada */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-left"
          >
            <p className="mb-1 text-2xl font-semibold">
              {text}, {formattedName}! {greetingEnding} {emoji}
            </p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-gray-400 text-sm"
            >
              Esperamos que seu dia seja incrível 🚀
            </motion.p>
          </motion.div>

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
