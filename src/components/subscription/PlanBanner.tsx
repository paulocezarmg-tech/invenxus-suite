import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, CreditCard, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PlanBanner() {
  const { subscription } = usePlanLimits();
  const navigate = useNavigate();

  if (!subscription) return null;

  const shouldShowBanner = 
    (subscription.daysUntilExpiry <= 7 && subscription.daysUntilExpiry > 0) ||
    (subscription.isTrialExpiringSoon) ||
    (subscription.paymentStatus === "pending" || subscription.paymentStatus === "failed") ||
    (subscription.status === "expired" || subscription.status === "cancelled");

  if (!shouldShowBanner) return null;

  const getAlertVariant = (): "default" | "destructive" => {
    if (subscription.status === "expired" || 
        subscription.status === "cancelled" ||
        subscription.daysUntilExpiry <= 3 || 
        subscription.paymentStatus === "pending" ||
        subscription.paymentStatus === "failed") {
      return "destructive";
    }
    return "default";
  };

  const getAlertContent = () => {
    if (subscription.status === "expired") {
      return {
        icon: <XCircle className="h-4 w-4" />,
        title: "Assinatura Expirada",
        description: "Sua assinatura expirou. Renove agora para continuar usando o sistema.",
      };
    }

    if (subscription.status === "cancelled") {
      return {
        icon: <XCircle className="h-4 w-4" />,
        title: "Assinatura Cancelada",
        description: "Sua assinatura foi cancelada. Reative para continuar usando o sistema.",
      };
    }

    if (subscription.paymentStatus === "failed") {
      return {
        icon: <CreditCard className="h-4 w-4" />,
        title: "Falha no Pagamento",
        description: "Houve uma falha no pagamento da sua assinatura. Por favor, atualize seus dados de pagamento. O sistema será bloqueado em 3 dias.",
      };
    }

    if (subscription.paymentStatus === "pending") {
      return {
        icon: <CreditCard className="h-4 w-4" />,
        title: "Pagamento Pendente",
        description: "Há um pagamento pendente em sua assinatura. Por favor, atualize seus dados de pagamento para evitar interrupção do serviço.",
      };
    }

    if (subscription.isTrialExpiringSoon) {
      return {
        icon: <Calendar className="h-4 w-4" />,
        title: "Trial Expirando",
        description: `Seu período de trial expira em breve. Assine um plano para continuar usando todos os recursos.`,
      };
    }

    if (subscription.daysUntilExpiry <= 7) {
      return {
        icon: <AlertCircle className="h-4 w-4" />,
        title: "Plano Expirando",
        description: `Seu plano expira em ${subscription.daysUntilExpiry} dia(s). Renove agora para continuar sem interrupções.`,
      };
    }

    return null;
  };

  const content = getAlertContent();
  if (!content) return null;

  return (
    <Alert variant={getAlertVariant()} className="mb-6">
      {content.icon}
      <AlertTitle>{content.title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{content.description}</span>
        <Button 
          size="sm" 
          variant={getAlertVariant() === "destructive" ? "default" : "outline"}
          onClick={() => navigate("/subscription")}
        >
          {subscription.paymentStatus === "pending" || subscription.paymentStatus === "failed" ? "Atualizar Pagamento" : "Renovar Agora"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
