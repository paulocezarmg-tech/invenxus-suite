import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "./useOrganization";
import { toast } from "sonner";

interface PlanLimits {
  maxUsers: number;
  maxCompanies: number;
  maxProducts: number;
  maxMovements: number;
  aiFeatures: {
    enabled: boolean;
    monthly_limit: number;
  };
}

interface CurrentUsage {
  users: number;
  companies: number;
  products: number;
  movements: number;
  aiUsage: number;
}

interface SubscriptionInfo {
  planName: string;
  status: string;
  renewalDate: string;
  trialEndDate: string | null;
  daysUntilExpiry: number;
  isTrialExpiringSoon: boolean;
  paymentStatus: string;
}

export function usePlanLimits() {
  const { data: organizationId } = useOrganization();

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery({
    queryKey: ["subscription", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          plan:plans(*)
        `)
        .eq("organization_id", organizationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: usage, isLoading: isLoadingUsage } = useQuery({
    queryKey: ["plan-usage", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const [usersCount, productsCount, movementsCount] = await Promise.all([
        supabase
          .from("organization_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
        supabase
          .from("movements")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId),
      ]);

      return {
        users: usersCount.count || 0,
        companies: 1, // Por enquanto, 1 empresa por organização
        products: productsCount.count || 0,
        movements: movementsCount.count || 0,
        aiUsage: 0, // TODO: Implementar contagem de uso de IA
      } as CurrentUsage;
    },
    enabled: !!organizationId,
  });

  const checkLimit = (type: keyof PlanLimits): boolean => {
    if (!subscription?.plan || !usage) return true;

    const plan = subscription.plan as any;
    const limits: PlanLimits = {
      maxUsers: plan.max_users,
      maxCompanies: plan.max_companies,
      maxProducts: plan.max_products,
      maxMovements: plan.max_movements,
      aiFeatures: plan.ai_features,
    };

    switch (type) {
      case "maxUsers":
        return usage.users < limits.maxUsers;
      case "maxCompanies":
        return usage.companies < limits.maxCompanies;
      case "maxProducts":
        return usage.products < limits.maxProducts;
      case "maxMovements":
        return usage.movements < limits.maxMovements;
      case "aiFeatures":
        return limits.aiFeatures.enabled && usage.aiUsage < limits.aiFeatures.monthly_limit;
      default:
        return true;
    }
  };

  const showLimitError = (type: string) => {
    toast.error("Limite do plano atingido", {
      description: `Você atingiu o limite de ${type} do seu plano. Faça upgrade para continuar.`,
      action: {
        label: "Fazer Upgrade",
        onClick: () => {
          window.location.href = "/subscription";
        },
      },
    });
  };

  const canCreateUser = (): boolean => {
    const canCreate = checkLimit("maxUsers");
    if (!canCreate) showLimitError("usuários");
    return canCreate;
  };

  const canCreateProduct = (): boolean => {
    const canCreate = checkLimit("maxProducts");
    if (!canCreate) showLimitError("produtos");
    return canCreate;
  };

  const canCreateMovement = (): boolean => {
    const canCreate = checkLimit("maxMovements");
    if (!canCreate) showLimitError("movimentações");
    return canCreate;
  };

  const canUseAI = (): boolean => {
    const canUse = checkLimit("aiFeatures");
    if (!canUse) showLimitError("recursos de IA");
    return canUse;
  };

  const getSubscriptionInfo = (): SubscriptionInfo | null => {
    if (!subscription) return null;

    const plan = subscription.plan as any;
    const renewalDate = new Date(subscription.renewal_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let trialDays = 0;
    if (subscription.trial_end_date) {
      const trialEnd = new Date(subscription.trial_end_date);
      trialDays = Math.ceil((trialEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      planName: plan.name,
      status: subscription.status,
      renewalDate: subscription.renewal_date,
      trialEndDate: subscription.trial_end_date,
      daysUntilExpiry,
      isTrialExpiringSoon: trialDays > 0 && trialDays < 5,
      paymentStatus: subscription.payment_status,
    };
  };

  const limits: PlanLimits | null = subscription?.plan
    ? {
        maxUsers: (subscription.plan as any).max_users,
        maxCompanies: (subscription.plan as any).max_companies,
        maxProducts: (subscription.plan as any).max_products,
        maxMovements: (subscription.plan as any).max_movements,
        aiFeatures: (subscription.plan as any).ai_features,
      }
    : null;

  return {
    limits,
    usage,
    subscription: getSubscriptionInfo(),
    isLoading: isLoadingSubscription || isLoadingUsage,
    canCreateUser,
    canCreateProduct,
    canCreateMovement,
    canUseAI,
    checkLimit,
  };
}
