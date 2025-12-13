import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MFAVerification } from "@/components/auth/MFAVerification";
import logo from "@/assets/stockmaster-logo.png";
import warehouseBg from "@/assets/warehouse-background.avif";

const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

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
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
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
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      </div>
      <Card className="w-full max-w-md shadow-elevated relative z-10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-2">
            <img src={logo} alt="StockMaster Logo" className="h-28 w-28 object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold">StockMaster CMS</CardTitle>
          <CardDescription>Sistema de Controle de Estoque</CardDescription>
        </CardHeader>

        <Form {...loginForm}>
          <form onSubmit={loginForm.handleSubmit(handleLogin)}>
            <CardContent className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" disabled={loading} {...field} />
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
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default Auth;
