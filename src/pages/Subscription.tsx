import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Loader2, Sparkles, Users, Package, TrendingUp, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Subscription() {
  const { limits, usage, subscription, isLoading } = usePlanLimits();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("status", "active")
        .order("price", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      active: { variant: "default", label: "Ativo" },
      trial: { variant: "secondary", label: "Trial" },
      expired: { variant: "destructive", label: "Expirado" },
      cancelled: { variant: "outline", label: "Cancelado" },
    };
    
    const config = statusMap[status] || statusMap.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-destructive";
    if (percentage >= 70) return "bg-yellow-500";
    return "bg-primary";
  };

  const calculatePercentage = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Minha Assinatura</h1>
          <p className="text-muted-foreground">Gerencie seu plano e acompanhe o uso</p>
        </div>
        <Button onClick={() => setUpgradeDialogOpen(true)} size="lg">
          <Sparkles className="mr-2 h-5 w-5" />
          Fazer Upgrade
        </Button>
      </div>

      {subscription && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Plano Atual
                {getStatusBadge(subscription.status)}
              </CardTitle>
              <CardDescription>Detalhes da sua assinatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{subscription.planName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Data de Renovação:</span>
                  <span className="font-medium">
                    {format(new Date(subscription.renewalDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>

                {subscription.daysUntilExpiry <= 7 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
                      ⚠️ Seu plano expira em {subscription.daysUntilExpiry} dia(s)
                    </p>
                  </div>
                )}

                {subscription.trialEndDate && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-500">
                      🎉 Trial ativo até{" "}
                      {format(new Date(subscription.trialEndDate), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {subscription.paymentStatus === "pending" && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm font-medium text-red-600 dark:text-red-500">
                      ⚠️ Pagamento pendente
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {limits && usage && (
            <Card>
              <CardHeader>
                <CardTitle>Uso do Plano</CardTitle>
                <CardDescription>Acompanhe seus limites e consumo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Usuários</span>
                    </div>
                    <span className="font-medium">
                      {usage.users} / {limits.maxUsers}
                    </span>
                  </div>
                  <Progress 
                    value={calculatePercentage(usage.users, limits.maxUsers)} 
                    className={getProgressColor(calculatePercentage(usage.users, limits.maxUsers))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>Produtos</span>
                    </div>
                    <span className="font-medium">
                      {usage.products} / {limits.maxProducts}
                    </span>
                  </div>
                  <Progress 
                    value={calculatePercentage(usage.products, limits.maxProducts)} 
                    className={getProgressColor(calculatePercentage(usage.products, limits.maxProducts))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span>Movimentações</span>
                    </div>
                    <span className="font-medium">
                      {usage.movements} / {limits.maxMovements}
                    </span>
                  </div>
                  <Progress 
                    value={calculatePercentage(usage.movements, limits.maxMovements)} 
                    className={getProgressColor(calculatePercentage(usage.movements, limits.maxMovements))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>Empresas</span>
                    </div>
                    <span className="font-medium">
                      {usage.companies} / {limits.maxCompanies}
                    </span>
                  </div>
                  <Progress 
                    value={calculatePercentage(usage.companies, limits.maxCompanies)} 
                    className={getProgressColor(calculatePercentage(usage.companies, limits.maxCompanies))}
                  />
                </div>

                {limits.aiFeatures.enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <span>IA (mensal)</span>
                      </div>
                      <span className="font-medium">
                        {usage.aiUsage} / {limits.aiFeatures.monthly_limit}
                      </span>
                    </div>
                    <Progress 
                      value={calculatePercentage(usage.aiUsage, limits.aiFeatures.monthly_limit)} 
                      className={getProgressColor(calculatePercentage(usage.aiUsage, limits.aiFeatures.monthly_limit))}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Escolha seu Plano</DialogTitle>
            <DialogDescription>
              Selecione o plano ideal para suas necessidades
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans?.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">
                      {plan.price === 0 ? "Grátis" : `R$ ${plan.price.toFixed(2)}`}
                    </span>
                    {plan.price > 0 && <span className="text-muted-foreground">/mês</span>}
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{plan.max_users} usuário(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{plan.max_companies} empresa(s)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>{plan.max_products} produtos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>{plan.max_movements} movimentações</span>
                    </div>
                    {(plan.ai_features as any).enabled && (
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>{(plan.ai_features as any).monthly_limit} consultas IA/mês</span>
                      </div>
                    )}
                  </div>
                  <Button className="w-full mt-4" variant={plan.price === 0 ? "outline" : "default"}>
                    Selecionar Plano
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
