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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { KitDialog } from "@/components/kits/KitDialog";

export default function Kits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKit, setSelectedKit] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch user roles
  useQuery({
    queryKey: ["userRoles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const roles = data?.map(r => r.role) || [];
      setUserRole(roles.length > 0 ? roles[0] : null);
      return roles;
    },
  });

  // Fetch kits with items count
  const { data: kits, isLoading } = useQuery({
    queryKey: ["kits", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("kits")
        .select(`
          *,
          kit_items(count)
        `)
        .order("name");

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kits"] });
      toast.success("Kit excluído com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir kit");
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este kit?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (kit: any) => {
    setSelectedKit(kit);
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedKit(null);
    setIsDialogOpen(true);
  };

  const canManage = userRole === "admin" || userRole === "superadmin" || userRole === "almoxarife";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kits</h1>
          <p className="text-muted-foreground">
            Gerencie os kits de produtos
          </p>
        </div>
        {canManage && (
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Kit
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : kits && kits.length > 0 ? (
              kits.map((kit) => (
                <TableRow key={kit.id}>
                  <TableCell className="font-mono">{kit.sku}</TableCell>
                  <TableCell className="font-medium">{kit.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {kit.description || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      {kit.kit_items?.[0]?.count || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={kit.active ? "default" : "secondary"}>
                      {kit.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(kit)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(kit.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center">
                  Nenhum kit encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <KitDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        kit={selectedKit}
      />
    </div>
  );
}
