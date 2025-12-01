import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Pencil, Trash2, Activity, TrendingUp, TrendingDown } from "lucide-react";
import { MovementDialog } from "@/components/movements/MovementDialog";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
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
import { useOrganization } from "@/hooks/useOrganization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Movements = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  };

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
    queryKey: ["movement-stats", dateFrom, dateTo, organizationId],
    queryFn: async () => {
      if (!organizationId) return { total: 0, entries: 0, exits: 0, transfers: 0 };
      
      let query = supabase
        .from("movements")
        .select("type, quantity")
        .eq("organization_id", organizationId);

      if (dateFrom && dateTo) {
        query = query
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const entries = data?.filter(m => m.type === "IN").length || 0;
      const exits = data?.filter(m => m.type === "OUT").length || 0;
      const transfers = data?.filter(m => m.type === "TRANSFER").length || 0;
      
      return { total, entries, exits, transfers };
    },
    enabled: !!organizationId,
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ["movements", dateFrom, dateTo, typeFilter, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("movements")
        .select(`
          *,
          products (name, sku),
          kits (name, sku),
          from_location:locations!movements_from_location_id_fkey (name),
          to_location:locations!movements_to_location_id_fkey (name)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (dateFrom && dateTo) {
        query = query
          .gte("created_at", dateFrom.toISOString())
          .lte("created_at", dateTo.toISOString());
      }

      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter as "IN" | "OUT" | "TRANSFER");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
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

  const handleDeleteMultiple = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} movimentação(ões)?`)) return;

    try {
      const { error } = await supabase.from("movements").delete().in("id", selectedIds);
      if (error) throw error;

      toast.success("Movimentações excluídas com sucesso");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir movimentações");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === movements?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(movements?.map(m => m.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel("movements-realtime")
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movements' },
        () => {
          // Refresh movement list, stats and product quantities in cache
          queryClient.invalidateQueries({ queryKey: ["movements"] });
          queryClient.invalidateQueries({ queryKey: ["movement-stats"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-x-hidden" >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Movimentações</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Registrar entradas, saídas e transferências
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <DateRangeFilter onDateChange={handleDateChange} />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="IN">Entradas</SelectItem>
              <SelectItem value="OUT">Saídas</SelectItem>
              <SelectItem value="TRANSFER">Transferências</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && userRole === "superadmin" && (
            <Button onClick={handleDeleteMultiple} variant="destructive" className="gap-2 w-full sm:w-auto">
              <Trash2 className="h-4 w-4" />
              Excluir ({selectedIds.length})
            </Button>
          )}
          <Button
            className="gap-2 w-full sm:w-auto"
            onClick={() => {
              setSelectedMovement(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Movimentação</span>
            <span className="inline sm:hidden">Lançar</span>
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between py-2 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Total de Movimentações</CardTitle>
            <Activity className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </CardHeader>
          <CardContent className="py-2 md:py-3">
            <div className="text-xl md:text-3xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between py-2 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-success" />
          </CardHeader>
          <CardContent className="py-2 md:py-3">
            <div className="text-xl md:text-3xl font-bold text-success">{stats?.entries || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between py-2 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-danger" />
          </CardHeader>
          <CardContent className="py-2 md:py-3">
            <div className="text-xl md:text-3xl font-bold text-danger">{stats?.exits || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/50 border-border shadow-card">
          <CardHeader className="flex flex-row items-center justify-between py-2 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">Transferências</CardTitle>
            <ArrowRightLeft className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </CardHeader>
          <CardContent className="py-2 md:py-3">
            <div className="text-xl md:text-3xl font-bold text-primary">{stats?.transfers || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-border bg-card/50 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow>
              {userRole === "superadmin" && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === movements?.length && movements?.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Data/Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Referência</TableHead>
              {(userRole === "superadmin" || userRole === "operador" || userRole === "almoxarife" || userRole === "admin") && <TableHead className="w-[100px]">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={(userRole === "superadmin" || userRole === "operador" || userRole === "almoxarife" || userRole === "admin") ? 8 : 7} className="text-center">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : movements && movements.length > 0 ? (
              movements.map((movement: any) => (
                <TableRow key={movement.id}>
                  {userRole === "superadmin" && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(movement.id)}
                        onCheckedChange={() => handleSelectOne(movement.id)}
                      />
                    </TableCell>
                  )}
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
                  <TableCell className="font-medium">
                    {new Intl.NumberFormat("pt-BR").format(Number(movement.quantity))}
                  </TableCell>
                  <TableCell>{movement.from_location?.name || "-"}</TableCell>
                  <TableCell>{movement.to_location?.name || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {movement.reference || "-"}
                  </TableCell>
                  {(userRole === "superadmin" || userRole === "operador" || userRole === "almoxarife" || userRole === "admin") && (
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
                        {userRole === "superadmin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(movement.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={(userRole === "superadmin" || userRole === "operador" || userRole === "almoxarife" || userRole === "admin") ? 8 : 7} className="text-center text-muted-foreground">
                  Nenhuma movimentação encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
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
