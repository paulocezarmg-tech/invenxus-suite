import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, Mail, Phone, Lock, Camera, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z.string().trim().email("Email inválido"),
  phone: z.string().trim().max(20, "Telefone deve ter no máximo 20 caracteres").optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha deve ter no máximo 72 caracteres").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Phone mask for Brazilian format
const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

export function ProfileSettings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return { ...user, profile };
    },
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  useEffect(() => {
    if (currentUser) {
      form.reset({
        name: currentUser.profile?.name || "",
        email: currentUser.email || "",
        phone: currentUser.profile?.phone ? formatPhone(currentUser.profile.phone) : "",
        password: "",
      });
      setAvatarPreview(currentUser.profile?.avatar_url || "");
    }
  }, [currentUser, form]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    form.setValue("phone", formatted);
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      // Upload avatar if changed
      let avatarUrl = currentUser.profile?.avatar_url;
      if (avatar) {
        const fileExt = avatar.name.split('.').pop();
        const fileName = `${currentUser.id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatar, { upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
        
        avatarUrl = publicUrl;
      }

      // Remove mask from phone before saving
      const cleanPhone = data.phone?.replace(/\D/g, "") || null;

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          phone: cleanPhone,
          avatar_url: avatarUrl,
        })
        .eq('user_id', currentUser.id);

      if (profileError) throw profileError;

      // Update email and/or password via secure backend function
      if (data.email !== currentUser.email || data.password) {
        const { data: updateData, error: updateError } = await supabase.functions.invoke(
          'update-user',
          {
            body: {
              targetUserId: currentUser.id,
              email: data.email !== currentUser.email ? data.email : undefined,
              password: data.password || undefined,
            },
          }
        );

        if (updateError) throw updateError;
        if (updateData?.error) throw new Error(updateData.error);

        // If user changed their password, re-authenticate
        if (data.password) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });

          if (signInError) {
            toast.error("Senha alterada, mas falha ao fazer login novamente. Por favor, faça login manualmente.");
            await supabase.auth.signOut();
            return;
          }
        }
      }

      toast.success("Perfil atualizado com sucesso!");
      form.reset({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: "",
      });
      setAvatar(null);
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error(error.message || "Erro ao atualizar perfil");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header Card with Avatar */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-8 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <Avatar className="h-28 w-28 ring-4 ring-primary/20 ring-offset-2 ring-offset-background shadow-xl">
              <AvatarImage src={avatarPreview} className="object-cover" />
              <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                {currentUser?.profile?.name?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <Label 
              htmlFor="avatar" 
              className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="h-8 w-8 text-white" />
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </Label>
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-foreground">
              {currentUser?.profile?.name || "Seu Nome"}
            </h2>
            <p className="text-muted-foreground">{currentUser?.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
              <Label htmlFor="avatar-btn" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium">
                  <Upload className="h-4 w-4" />
                  Alterar foto
                </div>
                <Input
                  id="avatar-btn"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              JPG, PNG ou GIF. Máximo 5MB.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal Info Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Informações Pessoais</h3>
              <p className="text-sm text-muted-foreground">Atualize seus dados básicos</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nome completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Seu nome completo"
                  className="pl-10 bg-background h-11"
                />
              </div>
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  value={form.watch("phone") || ""}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                  className="pl-10 bg-background h-11"
                  maxLength={16}
                />
              </div>
              {form.formState.errors.phone && (
                <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Conta</h3>
              <p className="text-sm text-muted-foreground">Gerencie seu email de acesso</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                {...form.register("email")}
                placeholder="seu@email.com"
                className="pl-10 bg-background h-11"
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
        </div>

        {/* Security Section */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Segurança</h3>
              <p className="text-sm text-muted-foreground">Altere sua senha de acesso</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Nova senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                {...form.register("password")}
                placeholder="••••••••"
                className="pl-10 bg-background h-11"
              />
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Mínimo de 6 caracteres. Deixe em branco se não quiser alterar.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-success hover:bg-success/90 text-white font-medium text-base shadow-lg shadow-success/25"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="h-5 w-5" />
              Salvar alterações
            </span>
          )}
        </Button>
      </form>
    </div>
  );
}
