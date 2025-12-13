import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2, HelpCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface MFAVerificationProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerification({ factorId, onSuccess, onCancel }: MFAVerificationProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error("Código inválido. Tente novamente.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-elevated">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">Verificação em Duas Etapas</CardTitle>
        <CardDescription>
          Digite o código do seu aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            autoFocus
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleVerify}
            disabled={verifying || code.length !== 6}
            className="w-full"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              "Verificar"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="w-full"
          >
            Voltar
          </Button>
        </div>

        <div className="pt-2">
          <Button
            variant="link"
            onClick={() => setShowHelp(!showHelp)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            Perdeu acesso ao autenticador?
          </Button>
        </div>

        {showHelp && (
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertTitle>Recuperação de Acesso</AlertTitle>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                Se você perdeu acesso ao seu aplicativo autenticador, entre em contato com um administrador do sistema.
              </p>
              <p>
                O administrador pode desativar a autenticação de dois fatores da sua conta, permitindo que você faça login novamente e configure um novo autenticador.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Abra seu aplicativo autenticador (Google Authenticator, Authy, etc.) para obter o código.
        </p>
      </CardContent>
    </Card>
  );
}
