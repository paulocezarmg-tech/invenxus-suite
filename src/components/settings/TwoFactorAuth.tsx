import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Check } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TwoFactorAuth() {
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showUnenrollDialog, setShowUnenrollDialog] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [copied, setCopied] = useState(false);

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find(f => f.status === 'verified');
      setIsEnrolled(!!totpFactor);
      if (totpFactor) {
        setFactorId(totpFactor.id);
      }
    } catch (error: any) {
      console.error("Error checking MFA status:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'StockMaster Authenticator',
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setShowEnrollDialog(true);
    } catch (error: any) {
      console.error("Error enrolling MFA:", error);
      toast.error(error.message || "Erro ao configurar 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }

    setVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorId!,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorId!,
        challengeId: challengeData.id,
        code: otpCode,
      });

      if (verifyError) throw verifyError;

      setIsEnrolled(true);
      setShowEnrollDialog(false);
      setOtpCode("");
      toast.success("Autenticação de dois fatores ativada com sucesso!");
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error(error.message || "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (!factorId) return;

    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (error) throw error;

      setIsEnrolled(false);
      setFactorId(null);
      setShowUnenrollDialog(false);
      toast.success("Autenticação de dois fatores desativada");
    } catch (error: any) {
      console.error("Error unenrolling MFA:", error);
      toast.error(error.message || "Erro ao desativar 2FA");
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Código copiado!");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-base">Autenticação de Dois Fatores</CardTitle>
                <CardDescription>
                  Adicione uma camada extra de segurança à sua conta
                </CardDescription>
              </div>
            </div>
            <Badge variant={isEnrolled ? "default" : "secondary"} className={isEnrolled ? "bg-emerald-500" : ""}>
              {isEnrolled ? (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Ativado
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldOff className="h-3 w-3" />
                  Desativado
                </span>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {isEnrolled
              ? "Sua conta está protegida com autenticação de dois fatores. Um código será solicitado a cada login."
              : "Use um aplicativo autenticador (Google Authenticator, Authy, etc.) para gerar códigos de verificação."}
          </p>
          {isEnrolled ? (
            <Button
              variant="outline"
              onClick={() => setShowUnenrollDialog(true)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Desativar 2FA
            </Button>
          ) : (
            <Button onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Ativar 2FA
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Enroll Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configurar Autenticação 2FA
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu aplicativo autenticador
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            </div>

            {/* Manual Secret */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground text-center">
                Ou digite o código manualmente:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono text-center break-all">
                  {secret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* OTP Input */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">
                Digite o código de 6 dígitos:
              </p>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpCode}
                  onChange={setOtpCode}
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
            </div>

            <Button
              onClick={handleVerify}
              disabled={verifying || otpCode.length !== 6}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                "Verificar e Ativar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unenroll Confirmation Dialog */}
      <AlertDialog open={showUnenrollDialog} onOpenChange={setShowUnenrollDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar 2FA?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua conta ficará menos protegida sem a autenticação de dois fatores.
              Você precisará configurar novamente se quiser reativar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrolling}
              className="bg-destructive hover:bg-destructive/90"
            >
              {unenrolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desativando...
                </>
              ) : (
                "Desativar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
