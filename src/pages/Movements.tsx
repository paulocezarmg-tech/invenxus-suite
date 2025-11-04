import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Pencil, Trash2, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { MovementDialog } from "@/components/movements/MovementDialog";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const Movements = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Check user role
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (roles && roles.length > 0) {
        setUserRole(roles[0].role);
      }
      return user;
    },
  });

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["movement-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("type, quantity");
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const entries = data?.filter(m => m.type === "IN").length || 0;
      const exits = data?.filter(m => m.type === "OUT").length || 0;
      const transfers = data?.filter(m => m.type === "TRANSFER").length || 0;
      
      return { total, entries, exits, transfers };
    },
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select(`
          *,
          products (name, sku),
          kits (name, sku),
          from_location:locations!movements_from_location_id_fkey (name),
          to_location:locations!movements_to_location_id_fkey (name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <ArrowDownCircle className="h-4 w-4 text-success" />;
      case "OUT":
        return <ArrowUpCircle className="h-4 w-4 text-danger" />;
      case "TRANSFER":
        return <ArrowRightLeft className="h-4 w-4 text-primary" />;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "IN":
        return <Badge className="bg-success text-white">Entrada</Badge>;
      case "OUT":
        return <Badge className="bg-danger text-white">Saída</Badge>;
      case "TRANSFER":
        return <Badge className="bg-primary text-white">Transferência</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta movimentação?")) return;

    try {
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) throw error;

      toast.success("Movimentação excluída");
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir movimentação");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimentações</h1>
          <p className="text-muted-foreground">
            Registrar entradas, saídas e transferências
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            setSelectedMovement(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Movimentações</CardTitle>
            <Activity className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entradas</CardTitle>
            <TrendingUp className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{stats?.entries || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saídas</CardTitle>
            <TrendingDown className="h-5 w-5 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-danger">{stats?.exits || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transferências</CardTitle>
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats?.transfers || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card/50 shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Referência</TableHead>
              {userRole === "superadmin" && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={userRole === "superadmin" ? 8 : 7} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : movements && movements.length > 0 ? (
              movements.map((movement: any) => (
                <TableRow key={movement.id}>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(movement.type)}
                      {getTypeBadge(movement.type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {movement.products?.name || movement.kits?.name || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {movement.products?.sku || movement.kits?.sku || "-"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{movement.quantity}</TableCell>
                  <TableCell>{movement.from_location?.name || "-"}</TableCell>
                  <TableCell>{movement.to_location?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {movement.reference || "-"}
                  </TableCell>
                  {userRole === "superadmin" && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedMovement(movement);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(movement.id)}
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
                <TableCell colSpan={userRole === "superadmin" ? 8 : 7} className="text-center text-muted-foreground">
                  Nenhuma movimentação encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <MovementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        movement={selectedMovement}
      />
    </div>
  );
};

export default Movements;
