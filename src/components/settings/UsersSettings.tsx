import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreVertical, Pencil, UserX, Trash2, Search, Upload, Shield } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useOrganization } from "@/hooks/useOrganization";

type Role = "superadmin" | "admin" | "almoxarife" | "operador" | "auditor";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha deve ter no máximo 72 caracteres"),
  role: z.enum(["superadmin", "admin", "almoxarife", "operador", "auditor"]),
});

const editUserSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome deve ter no máximo 200 caracteres"),
  email: z.string().trim().email("Email inválido"),
  phone: z.string().trim().max(20, "Telefone deve ter no máximo 20 caracteres").optional(),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha deve ter no máximo 72 caracteres").optional().or(z.literal("")),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

const roleLabels: Record<Role, string> = {
  superadmin: "Super Admin",
  admin: "Administrador",
  almoxarife: "Almoxarife",
  operador: "Operador",
  auditor: "Auditor",
};

const roleColors: Record<Role, string> = {
  superadmin: "bg-accent text-white",
  admin: "bg-success text-white",
  almoxarife: "bg-primary text-white",
  operador: "bg-secondary text-white",
  auditor: "bg-muted-foreground/20 text-foreground",
};

export function UsersSettings() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editAvatar, setEditAvatar] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "operador",
    },
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Ensure current user's profile exists
      const { data: userRes } = await supabase.auth.getUser();
      const currentUser = userRes?.user;
      if (currentUser && organizationId) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", currentUser.id)
          .maybeSingle();
        if (!existingProfile) {
          await supabase.from("profiles").insert({
            user_id: currentUser.id,
            name:
              (currentUser.user_metadata as any)?.name ||
              currentUser.email?.split("@")[0] ||
              "Usuário",
            organization_id: organizationId,
          });
        }
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          user_id,
          name,
          avatar_url,
          phone,
          created_at
        `);

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch auth users via secure backend function (degrades gracefully if not authorized)
      let authUsers: Array<{ id: string; email: string | null; created_at?: string }> = [];
      try {
        const { data: funcData, error: funcError } = await supabase.functions.invoke(
          "list-users"
        );
        if (!funcError && (funcData as any)?.users) {
          authUsers = (funcData as any).users as typeof authUsers;
        }
      } catch {
        // ignore and continue with profiles only
      }

      return profiles.map((profile) => {
        const authUser = authUsers.find((u) => u.id === profile.user_id);
        const userRoles = roles.filter((r) => r.user_id === profile.user_id);

        return {
          ...profile,
          email: authUser?.email || "",
          roles: userRoles.map((r) => r.role as Role),
          active: true,
        };
      });
    },
  });

  const filteredUsers = users?.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateUser = async (data: CreateUserFormData) => {
    setIsSubmitting(true);
    try {
      if (!organizationId) throw new Error("Organization not found");
      
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { name: data.name },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) throw new Error("Usuário não criado");

      const { error: profileError } = await supabase.from("profiles").insert({
        user_id: authData.user.id,
        name: data.name,
        organization_id: organizationId,
      });

      if (profileError) throw profileError;

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: data.role });

      if (roleError) throw roleError;

      toast.success("Usuário criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setDialogOpen(false);
      createForm.reset();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      // Substitui todas as funções atuais por uma única função selecionada
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;

      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });
      if (insErr) throw insErr;

      toast.success("Permissão atualizada");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar permissão");
    }
  };

  const handleManageRoles = async () => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    try {
      // Delete all current roles
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.user_id);
      
      if (delErr) throw delErr;

      // Insert selected roles
      if (selectedRoles.length > 0) {
        const rolesToInsert = selectedRoles.map(role => ({
          user_id: selectedUser.user_id,
          role: role,
        }));

        const { error: insErr } = await supabase
          .from("user_roles")
          .insert(rolesToInsert);
        
        if (insErr) throw insErr;
      }

      toast.success("Funções atualizadas com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setRolesDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar funções");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRole = (role: Role) => {
    setSelectedRoles(prev => 
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { targetUserId: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário excluído");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir usuário");
    }
  };

  useEffect(() => {
    if (selectedUser && editDialogOpen) {
      editForm.reset({
        name: selectedUser.name || "",
        email: selectedUser.email || "",
        phone: selectedUser.phone || "",
        password: "",
      });
      setEditAvatarPreview(selectedUser.avatar_url || "");
    }
  }, [selectedUser, editDialogOpen, editForm]);

  const handleEditUser = async (data: EditUserFormData) => {
    if (!selectedUser) return;
    
    setIsSubmitting(true);
    try {
      // Get current user to check if editing own profile
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const isEditingSelf = currentUser?.id === selectedUser.user_id;
      const isChangingOwnPassword = isEditingSelf && data.password;

      // Upload avatar if changed
      let avatarUrl = selectedUser.avatar_url;
      if (editAvatar) {
        const fileExt = editAvatar.name.split('.').pop();
        const fileName = `${selectedUser.user_id}/${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editAvatar, { upsert: true });
        
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
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Update email and/or password via secure backend function
      if (data.email !== selectedUser.email || data.password) {
        const { data: updateData, error: updateError } = await supabase.functions.invoke(
          'update-user',
          {
            body: {
              targetUserId: selectedUser.user_id,
              email: data.email !== selectedUser.email ? data.email : undefined,
              password: data.password || undefined,
            },
          }
        );

        if (updateError) throw updateError;
        if (updateData?.error) throw new Error(updateData.error);

        // If user changed their own password, re-authenticate with new password
        if (isChangingOwnPassword && data.password) {
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

      toast.success("Usuário atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setEditDialogOpen(false);
      editForm.reset();
      setEditAvatar(null);
      setEditAvatarPreview("");
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.message || "Erro ao atualizar usuário");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-card border border-border">
              <Plus className="h-5 w-5" />
            </div>
            Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualize os usuários cadastrados no sistema.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 bg-success hover:bg-success/90 text-white">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-card/50 border-border"
        />
      </div>

      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Usuário</TableHead>
              <TableHead className="text-muted-foreground">Função</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Data de criação</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredUsers && filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-border">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.name?.charAt(0).toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.roles.map((role) => (
                        <Badge key={role} className={roleColors[role]}>
                          {roleLabels[role]}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={user.active} className="data-[state=checked]:bg-success" />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(user.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short"
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      há {formatDistanceToNow(new Date(user.created_at), { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setEditDialogOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedRoles(user.roles || []);
                            setRolesDialogOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Gerenciar Funções
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer">
                          <UserX className="mr-2 h-4 w-4" />
                          Desativar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteUser(user.user_id)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Deletar usuário
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum usuário encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditUser)} className="grid gap-4 py-4">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={editAvatarPreview} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {editForm.watch("name")?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
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
              </div>
              
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do usuário" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(00) 00000-0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha (deixe em branco para não alterar)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Funções</DialogTitle>
            <DialogDescription>
              Selecione as funções que deseja atribuir a {selectedUser?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-3">
              {(Object.entries(roleLabels) as [Role, string][]).map(([role, label]) => (
                <div key={role} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{label}</div>
                      <Badge className={`${roleColors[role]} mt-1`} variant="secondary">
                        {role}
                      </Badge>
                    </div>
                  </div>
                  <Switch
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                    className="data-[state=checked]:bg-success"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRolesDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button onClick={handleManageRoles} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Funções"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário e defina suas permissões
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Senha de acesso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permissão</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Criando..." : "Criar Usuário"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
