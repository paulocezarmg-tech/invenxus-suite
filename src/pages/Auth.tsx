import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, Lock, Sparkles, Shield, Package } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MFAVerification } from "@/components/auth/MFAVerification";
import logo from "@/assets/stockmaster-logo.png";
import warehouseBg from "@/assets/warehouse-background.avif";

const recoverySchema = z.object({
  email: z.string().trim().email("Email inválido"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RecoveryFormData = z.infer<typeof recoverySchema>;

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const recoveryForm = useForm<RecoveryFormData>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      email: "",
    },
  });

  const handlePasswordRecovery = async (data: RecoveryFormData) => {
    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      
      if (error) throw error;
      
      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setShowRecoveryDialog(false);
      recoveryForm.reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar email de recuperação");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      // Check if MFA is required
      if (authData.session?.user) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factorsData?.totp.find(f => f.status === 'verified');
        
        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setShowMFA(true);
          setLoading(false);
          return;
        }
      }

      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleMFASuccess = () => {
    toast.success("Login realizado com sucesso!");
    navigate("/");
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setShowMFA(false);
    setMfaFactorId(null);
  };

  if (showMFA && mfaFactorId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative">
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${warehouseBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/90 to-background/95 backdrop-blur-sm" />
        </div>
        <div className="relative z-10">
          <MFAVerification
            factorId={mfaFactorId}
            onSuccess={handleMFASuccess}
            onCancel={handleMFACancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Background with gradient overlay */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${warehouseBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-background/85 to-background/95" />
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 flex-col justify-center items-center p-12">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <img src={logo} alt="StockMaster Logo" className="h-24 w-24 object-contain relative z-10" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                StockMaster
              </h1>
              <p className="text-primary font-medium">CMS Premium</p>
            </div>
          </div>
          
          <p className="text-xl text-muted-foreground leading-relaxed">
            Sistema completo de controle de estoque para empresas que buscam excelência na gestão.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
              <div className="p-3 rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Gestão Inteligente</h3>
                <p className="text-sm text-muted-foreground">Controle total do seu inventário</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
              <div className="p-3 rounded-lg bg-accent/10">
                <Sparkles className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Relatórios Avançados</h3>
                <p className="text-sm text-muted-foreground">Análises e previsões com IA</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50">
              <div className="p-3 rounded-lg bg-success/10">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Segurança Total</h3>
                <p className="text-sm text-muted-foreground">Proteção com autenticação 2FA</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <img src={logo} alt="StockMaster Logo" className="h-20 w-20 object-contain relative z-10" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">StockMaster CMS</h1>
          </div>

          {/* Login Card */}
          <div className="relative">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-lg opacity-75" />
            
            <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 shadow-2xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">Bem-vindo de volta</h2>
                <p className="text-muted-foreground">Entre com suas credenciais para acessar</p>
              </div>

              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-5">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground font-medium">Email</FormLabel>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                              <Input 
                                type="email" 
                                placeholder="seu@email.com" 
                                disabled={loading} 
                                className="pl-12 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all rounded-lg"
                                {...field} 
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-foreground font-medium">Senha</FormLabel>
                          <button
                            type="button"
                            onClick={() => setShowRecoveryDialog(true)}
                            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                          >
                            Esqueceu a senha?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <div className="relative">
                              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="••••••••" 
                                disabled={loading} 
                                className="pl-12 pr-12 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all rounded-lg"
                                {...field} 
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-5 w-5" />
                                ) : (
                                  <Eye className="h-5 w-5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 transition-all duration-300 rounded-lg mt-2" 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-5 w-5" />
                        Acessar Sistema
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-8 pt-6 border-t border-border/50">
                <p className="text-center text-sm text-muted-foreground">
                  Protegido por autenticação segura
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Shield className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Conexão criptografada</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © 2024 StockMaster CMS. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Password Recovery Dialog */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              Recuperar Senha
            </DialogTitle>
            <DialogDescription>
              Digite seu email e enviaremos um link para redefinir sua senha.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...recoveryForm}>
            <form onSubmit={recoveryForm.handleSubmit(handlePasswordRecovery)} className="space-y-4">
              <FormField
                control={recoveryForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                          type="email" 
                          placeholder="seu@email.com" 
                          disabled={recoveryLoading}
                          className="pl-12 h-12"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRecoveryDialog(false)}
                  disabled={recoveryLoading}
                  className="flex-1 h-11"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={recoveryLoading} 
                  className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/80"
                >
                  {recoveryLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar Link"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
