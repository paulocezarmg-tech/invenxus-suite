import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import logo from "@/assets/stockmaster-logo.png";

const signupSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("id");
  
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const validateInvite = async () => {
      if (!inviteId) {
        setError("Link de convite inválido");
        setValidating(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("invites")
          .select("*")
          .eq("id", inviteId)
          .single();

        if (error || !data) {
          setError("Convite não encontrado");
          setValidating(false);
          return;
        }

        if (data.status !== "pending") {
          setError("Este convite já foi usado ou cancelado");
          setValidating(false);
          return;
        }

        if (new Date(data.expires_at) < new Date()) {
          setError("Este convite expirou");
          setValidating(false);
          return;
        }

        setInvite(data);
        setValidating(false);
      } catch (err: any) {
        setError("Erro ao validar convite");
        setValidating(false);
      }
    };

    validateInvite();
  }, [inviteId]);

  const getErrorMessage = (error: any): string => {
    const message = error.message?.toLowerCase() || '';
    
    // Map common Supabase auth errors to Portuguese
    if (message.includes('user already registered') || message.includes('email already exists')) {
      return 'Este email já está cadastrado no sistema';
    }
    if (message.includes('invalid email')) {
      return 'Email inválido';
    }
    if (message.includes('password')) {
      return 'Senha inválida. Deve ter no mínimo 6 caracteres';
    }
    if (message.includes('network')) {
      return 'Erro de conexão. Verifique sua internet';
    }
    
    return 'Erro ao criar conta. Tente novamente';
  };

  const handleSignup = async (data: SignupFormData) => {
    if (!invite) return;
    
    setLoading(true);

    try {
      // Use the admin edge function to handle everything
      const { data: result, error } = await supabase.functions.invoke('accept-invite', {
        body: {
          inviteId: inviteId,
          name: data.name,
          password: data.password,
        }
      });

      if (error) {
        console.error('Error accepting invite:', error);
        throw new Error('Erro ao processar convite');
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao processar convite');
      }

      toast.success("Cadastro concluído com sucesso! Faça login para acessar o sistema.");
      
      setTimeout(() => {
        navigate("/auth");
      }, 100);
    } catch (error: any) {
      console.error("Signup error:", error);
      toast.error(error.message || "Erro ao completar cadastro");
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Validando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-danger mx-auto mb-4" />
            <CardTitle className="text-2xl">Convite Inválido</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="space-y-1 text-center">
          <div className="flex items-center justify-center mb-2">
            <img src={logo} alt="StockMaster Logo" className="h-24 w-24 object-contain" />
          </div>
          <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
          <CardTitle className="text-2xl font-bold">Bem-vindo!</CardTitle>
          <CardDescription>
            Você foi convidado para acessar o StockMaster como <strong>{invite?.role}</strong>
          </CardDescription>
          <p className="text-sm text-muted-foreground pt-2">
            Email: <strong>{invite?.email}</strong>
          </p>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSignup)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome" disabled={loading} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
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
                    Criando conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default AcceptInvite;
