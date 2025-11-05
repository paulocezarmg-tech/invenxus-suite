import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z.string().trim().email("Email inválido"),
  phone: z.string().trim().max(20, "Telefone deve ter no máximo 20 caracteres").optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha deve ter no máximo 72 caracteres").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

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
        phone: currentUser.profile?.phone || "",
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

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          phone: data.phone || null,
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
    <div className="rounded-lg border border-border bg-card/50 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Meu Perfil</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie suas informações pessoais
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarPreview} />
            <AvatarFallback className="bg-primary/10 text-primary text-2xl">
              {currentUser?.profile?.name?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="avatar" className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors">
                <Upload className="h-4 w-4" />
                Alterar foto
              </div>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </Label>
            <p className="text-xs text-muted-foreground mt-2">
              JPG, PNG ou GIF. Máximo 5MB.
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Seu nome"
            className="bg-background"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            placeholder="seu@email.com"
            className="bg-background"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            {...form.register("phone")}
            placeholder="(00) 00000-0000"
            className="bg-background"
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input
            id="password"
            type="password"
            {...form.register("password")}
            placeholder="Deixe em branco para manter a atual"
            className="bg-background"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Mínimo de 6 caracteres. Deixe em branco se não quiser alterar.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-success hover:bg-success/90 text-white"
        >
          {isSubmitting ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>
    </div>
  );
}
