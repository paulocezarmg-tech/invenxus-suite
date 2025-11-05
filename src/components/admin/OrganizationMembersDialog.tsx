import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface OrganizationMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
}

export function OrganizationMembersDialog({
  open,
  onOpenChange,
  organizationId,
}: OrganizationMembersDialogProps) {
  const queryClient = useQueryClient();

  const { data: organization } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data: memberData, error } = await supabase
        .from("organization_members")
        .select("*, user_id")
        .eq("organization_id", organizationId);

      if (error) throw error;

      // Get profiles and roles for each user
      const membersWithDetails = await Promise.all(
        memberData.map(async (member) => {
          const [profileRes, roleRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("name, avatar_url")
              .eq("user_id", member.user_id)
              .single(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", member.user_id)
              .single(),
          ]);

          return {
            ...member,
            profile: profileRes.data,
            role: roleRes.data?.role || "operador",
          };
        })
      );

      return membersWithDetails;
    },
    enabled: !!organizationId,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Membro removido com sucesso");
    },
    onError: () => {
      toast.error("Erro ao remover membro");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Membros da Organização</DialogTitle>
          <DialogDescription>
            {organization?.name} - Gerencie os membros desta organização
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : members && members.length > 0 ? (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={member.profile?.avatar_url || ""} />
                    <AvatarFallback>
                      {member.profile?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.profile?.name || "Usuário"}</p>
                    <Badge variant="outline" className="mt-1">
                      {member.role}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMemberMutation.mutate(member.id)}
                  disabled={removeMemberMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum membro encontrado
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
