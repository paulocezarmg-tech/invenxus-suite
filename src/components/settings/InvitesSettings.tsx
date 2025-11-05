import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, MoreVertical, Search, UserPlus, X, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrganization } from "@/hooks/useOrganization";

export const InvitesSettings = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("operador");
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const { data: invites, isLoading } = useQuery({
    queryKey: ["invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      if (!organizationId) throw new Error("Organization not found");

      const { data: invite, error } = await supabase.from("invites").insert({
        email,
        role: role as any,
        created_by: user.id,
        organization_id: organizationId,
      }).select().single();

      if (error) throw error;

      // Send invite email
      const { error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: { 
          email, 
          role,
          inviteId: invite.id,
          appUrl: window.location.origin
        }
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        throw new Error("Convite criado mas falha ao enviar email");
      }

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success(`Convite enviado com sucesso para ${email}!`);
      setIsDialogOpen(false);
      setEmail("");
      setRole("operador");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar convite: " + error.message);
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invites")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success("Convite cancelado!");
    },
    onError: (error: any) => {
      toast.error("Erro ao cancelar convite: " + error.message);
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (id: string) => {
      const { data: invite, error } = await supabase
        .from("invites")
        .update({ 
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Send invite email
      const { error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: { 
          email: invite.email, 
          role: invite.role,
          inviteId: invite.id,
          appUrl: window.location.origin
        }
      });

      if (emailError) {
        console.error("Error sending email:", emailError);
        throw new Error("Convite atualizado mas falha ao enviar email");
      }

      return invite;
    },
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success(`Convite reenviado para ${invite.email}!`);
    },
    onError: (error: any) => {
      toast.error("Erro ao reenviar convite: " + error.message);
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast.success("Convite excluído!");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir convite: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInvite.mutate();
  };

  const filteredInvites = invites?.filter((invite) =>
    invite.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    pending: "bg-warning/20 text-warning border-warning/30",
    accepted: "bg-success/20 text-success border-success/30",
    expired: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-cancelled/20 text-cancelled border-cancelled/30",
  };

  const statusLabels = {
    pending: "Pendente",
    accepted: "Aceito",
    expired: "Expirado",
    cancelled: "Cancelado",
  };

  const roleColors = {
    superadmin: "bg-danger/20 text-danger border-danger/30",
    admin: "bg-warning/20 text-warning border-warning/30",
    almoxarife: "bg-primary/20 text-primary border-primary/30",
    operador: "bg-success/20 text-success border-success/30",
    auditor: "bg-info/20 text-info border-info/30",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Convites</h2>
            <p className="text-sm text-muted-foreground">Gerencie convites de usuários</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4" />
              Novo Convite
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Convite</DialogTitle>
              <DialogDescription>
                Convide um novo usuário para acessar o sistema
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="almoxarife">Almoxarife</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createInvite.isPending}>
                  {createInvite.isPending ? "Enviando..." : "Enviar Convite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredInvites && filteredInvites.length > 0 ? (
              filteredInvites.map((invite) => (
                <TableRow key={invite.id} className="border-border">
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={roleColors[invite.role as keyof typeof roleColors]}>
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[invite.status as keyof typeof statusColors]}>
                      {statusLabels[invite.status as keyof typeof statusLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(invite.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(invite.expires_at) > new Date()
                      ? formatDistanceToNow(new Date(invite.expires_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : "Expirado"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {invite.status === "pending" && (
                          <>
                            <DropdownMenuItem
                              onClick={() => resendInvite.mutate(invite.id)}
                              className="cursor-pointer"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reenviar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => cancelInvite.mutate(invite.id)}
                              className="cursor-pointer"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuItem
                          onClick={() => deleteInvite.mutate(invite.id)}
                          className="cursor-pointer text-danger"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum convite encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
