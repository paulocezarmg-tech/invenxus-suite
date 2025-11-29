import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { AlertCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PlanBanner() {
  const { subscription } = usePlanLimits();
  const navigate = useNavigate();

  if (!subscription) return null;

  const showExpiryWarning = subscription.daysUntilExpiry <= 7 && subscription.daysUntilExpiry > 0;
  const showTrialWarning = subscription.isTrialExpiringSoon;
  const showPaymentWarning = subscription.paymentStatus === "pending";

  if (!showExpiryWarning && !showTrialWarning && !showPaymentWarning) {
    return null;
  }

  return (
    <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          {showPaymentWarning && (
            <p className="font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ Seu pagamento está pendente. Regularize para continuar usando todos os recursos.
            </p>
          )}
          {showExpiryWarning && !showPaymentWarning && (
            <p className="font-medium text-yellow-600 dark:text-yellow-500">
              ⚠️ Seu plano expira em {subscription.daysUntilExpiry} dia(s). Renove para não perder o acesso.
            </p>
          )}
          {showTrialWarning && !showPaymentWarning && !showExpiryWarning && (
            <p className="font-medium text-yellow-600 dark:text-yellow-500">
              🎉 Seu período de trial expira em breve. Faça upgrade para continuar!
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-4"
          onClick={() => navigate("/subscription")}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Ver Planos
        </Button>
      </AlertDescription>
    </Alert>
  );
}
