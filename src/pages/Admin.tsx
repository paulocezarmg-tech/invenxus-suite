import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users, Building2, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { OrganizationDialog } from "@/components/admin/OrganizationDialog";
import { OrganizationMembersDialog } from "@/components/admin/OrganizationMembersDialog";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
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

export default function Admin() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Priority order: superadmin > admin > almoxarife > auditor > operador
      const rolePriority: Record<string, number> = {
        superadmin: 5,
        admin: 4,
        almoxarife: 3,
        auditor: 2,
        operador: 1,
      };

      // Get the highest priority role
      const highestRole = data.reduce((highest, current) => {
        const currentPriority = rolePriority[current.role] || 0;
        const highestPriority = rolePriority[highest.role] || 0;
        return currentPriority > highestPriority ? current : highest;
      });

      return highestRole.role;
    },
  });

  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(`
          *,
          organization_members(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: userRole === "superadmin",
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ active })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Status da organização atualizado");
    },
    onError: () => {
      toast.error("Erro ao atualizar status da organização");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organização excluída com sucesso");
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao excluir organização");
    },
  });

  if (roleLoading || orgsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== "superadmin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Administração</h1>
          <p className="text-muted-foreground">
            Gerencie todas as organizações do sistema
          </p>
        </div>
        <Button onClick={() => {
          setEditingOrg(null);
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations?.map((org) => (
          <Card key={org.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{org.name}</CardTitle>
                </div>
                <Badge variant={org.active ? "default" : "secondary"}>
                  {org.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              <CardDescription>@{org.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Membros
                </span>
                <span className="font-medium">
                  {org.organization_members?.[0]?.count || 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Switch
                  checked={org.active}
                  onCheckedChange={(checked) =>
                    toggleActiveMutation.mutate({ id: org.id, active: checked })
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingOrg(org);
                    setDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setOrgToDelete(org);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelectedOrg(org.id);
                  setMembersDialogOpen(true);
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Gerenciar Membros
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <OrganizationDialog 
        open={dialogOpen} 
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingOrg(null);
        }}
        organization={editingOrg}
      />
      
      <OrganizationMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        organizationId={selectedOrg}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a organização <strong>{orgToDelete?.name}</strong>?
              Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => orgToDelete && deleteMutation.mutate(orgToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
