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
      let userId: string | null = null;
      let isNewUser = false;

      // Try to create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
          },
        },
      });

      if (authError) {
        // Check if user already exists
        if (authError.message?.toLowerCase().includes('already registered') || 
            authError.message?.toLowerCase().includes('email already exists')) {
          // Try to sign in to get the user ID
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password: data.password,
          });

          if (signInError) {
            throw new Error("Este email já está cadastrado com uma senha diferente. Use a recuperação de senha se necessário.");
          }

          if (!signInData.user) {
            throw new Error("Erro ao verificar usuário existente");
          }

          userId = signInData.user.id;
          // Sign out immediately as we'll let them login properly later
          await supabase.auth.signOut();
        } else {
          throw new Error(getErrorMessage(authError));
        }
      } else {
        if (!authData.user) {
          throw new Error("Erro ao criar usuário");
        }
        userId = authData.user.id;
        isNewUser = true;
      }

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      // Create profile only if it doesn't exist
      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            name: data.name,
            organization_id: invite.organization_id,
          });

        if (profileError) {
          console.error("Profile error:", profileError);
          throw new Error("Erro ao criar perfil do usuário");
        }
      }

      // Check if role exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", invite.role)
        .single();

      // Assign role only if it doesn't exist
      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: invite.role,
          });

        if (roleError) {
          console.error("Role error:", roleError);
          throw new Error("Erro ao atribuir permissões ao usuário");
        }
      }

      // Update invite status
      const { error: inviteError } = await supabase
        .from("invites")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", inviteId);

      if (inviteError) {
        console.error("Error updating invite:", inviteError);
      }

      // Notify admins about new user (only if it's a new user)
      if (isNewUser) {
        try {
          await supabase.functions.invoke("notify-admins-new-user", {
            body: {
              userName: data.name,
              userEmail: invite.email,
              userRole: invite.role,
            },
          });
        } catch (notifyError) {
          // Don't fail the signup if notification fails
          console.error("Error notifying admins:", notifyError);
        }
      }

      // Sign out the user so they can log in properly
      await supabase.auth.signOut();

      toast.success("Cadastro concluído com sucesso! Faça login para acessar o sistema.");
      
      // Use setTimeout to ensure navigation happens after state updates
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
