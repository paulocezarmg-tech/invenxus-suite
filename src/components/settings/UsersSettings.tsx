import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Plus, MoreVertical, Pencil, UserX, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Role = "superadmin" | "admin" | "almoxarife" | "operador" | "auditor";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("operador");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      // Ensure current user's profile exists
      const { data: userRes } = await supabase.auth.getUser();
      const currentUser = userRes?.user;
      if (currentUser) {
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

  const handleCreateUser = async () => {
    setIsSubmitting(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (signUpError) throw signUpError;

      if (!authData.user) throw new Error("Usuário não criado");

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: selectedRole });

      if (roleError) throw roleError;

      toast.success("Usuário criado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setDialogOpen(false);
      setEmail("");
      setPassword("");
      setName("");
      setSelectedRole("operador");
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
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast.success("Usuário excluído");
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir usuário");
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
                            const input = prompt(
                              `Escolha a permissão para ${user.name}:\n\n1. superadmin\n2. admin\n3. almoxarife\n4. operador\n5. auditor\n\nDica: você pode digitar o número (1-5) ou o nome.`
                            );
                            if (!input) return;
                            const value = input.trim().toLowerCase();
                            const map: Record<string, Role> = {
                              "1": "superadmin",
                              "2": "admin",
                              "3": "almoxarife",
                              "4": "operador",
                              "5": "auditor",
                              superadmin: "superadmin",
                              admin: "admin",
                              almoxarife: "almoxarife",
                              operador: "operador",
                              auditor: "auditor",
                            };
                            const role = map[value];
                            if (!role) {
                              toast.error("Entrada inválida. Digite 1-5 ou o nome da função.");
                              return;
                            }
                            handleUpdateRole(user.user_id, role);
                          }}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>
              Crie um novo usuário e defina suas permissões
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de acesso"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Permissão</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
