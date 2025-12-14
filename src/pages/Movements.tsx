import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Pencil, Trash2, Activity, TrendingUp, TrendingDown, Download, FileSpreadsheet } from "lucide-react";
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
import { SortableTableHead, useSorting } from "@/components/shared/SortableTableHead";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel, exportToCSV, ExportColumn } from "@/lib/export-utils";

const Movements = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateFrom(from);
    setDateTo(to);
  };

  // Fetch products for filter
  const { data: products } = useQuery({
    queryKey: ["products-filter", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Fetch kits for filter
  const { data: kits } = useQuery({
    queryKey: ["kits-filter", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("kits")
        .select("id, name, sku")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

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

  const { data: movementsData, isLoading } = useQuery({
    queryKey: ["movements", dateFrom, dateTo, typeFilter, productFilter, organizationId],
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

      // Product/Kit filter
      if (productFilter !== "all") {
        if (productFilter.startsWith("product_")) {
          query = query.eq("product_id", productFilter.replace("product_", ""));
        } else if (productFilter.startsWith("kit_")) {
          query = query.eq("kit_id", productFilter.replace("kit_", ""));
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { sortConfig, handleSort, sortedData: movements } = useSorting(movementsData, "created_at", "desc");

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

  // Export columns configuration
  const exportColumns: ExportColumn[] = [
    { 
      header: "Data", 
      key: "created_at",
      transform: (value) => format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR })
    },
    { 
      header: "Tipo", 
      key: "type",
      transform: (value) => value === "IN" ? "Entrada" : value === "OUT" ? "Saída" : "Transferência"
    },
    { 
      header: "Produto/Kit", 
      key: "products.name",
      transform: (value, row) => row.products?.name || row.kits?.name || "-"
    },
    { 
      header: "SKU", 
      key: "products.sku",
      transform: (value, row) => row.products?.sku || row.kits?.sku || "-"
    },
    { header: "Quantidade", key: "quantity" },
    { 
      header: "Origem", 
      key: "from_location.name",
      transform: (value) => value || "-"
    },
    { 
      header: "Destino", 
      key: "to_location.name",
      transform: (value) => value || "-"
    },
    { 
      header: "Referência", 
      key: "reference",
      transform: (value) => value || "-"
    },
    { 
      header: "Observação", 
      key: "note",
      transform: (value) => value || "-"
    },
  ];

  const handleExportExcel = () => {
    if (!movements || movements.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    exportToExcel(movements, exportColumns, "movimentacoes");
    toast.success("Arquivo Excel exportado com sucesso!");
  };

  const handleExportCSV = () => {
    if (!movements || movements.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }
    exportToCSV(movements, exportColumns, "movimentacoes");
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 overflow-x-hidden animate-fade-in">
        {/* Header Premium */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Movimentações</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Registrar entradas, saídas e transferências
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-wrap">
            <DateRangeFilter onDateChange={handleDateChange} />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-11 bg-card/80 backdrop-blur-sm border-border/50">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="IN">Entradas</SelectItem>
                <SelectItem value="OUT">Saídas</SelectItem>
                <SelectItem value="TRANSFER">Transferências</SelectItem>
              </SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-11 bg-card/80 backdrop-blur-sm border-border/50">
                <SelectValue placeholder="Produto/Kit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os itens</SelectItem>
                {products && products.length > 0 && (
                  <>
                    <SelectItem value="__products_header" disabled className="font-semibold text-xs text-muted-foreground uppercase">
                      Produtos
                    </SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={`product_${product.id}`}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </>
                )}
                {kits && kits.length > 0 && (
                  <>
                    <SelectItem value="__kits_header" disabled className="font-semibold text-xs text-muted-foreground uppercase mt-2">
                      Kits
                    </SelectItem>
                    {kits.map((kit) => (
                      <SelectItem key={kit.id} value={`kit_${kit.id}`}>
                        {kit.name} ({kit.sku})
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            {selectedIds.length > 0 && userRole === "superadmin" && (
              <Button onClick={handleDeleteMultiple} variant="destructive" className="gap-2 w-full sm:w-auto h-11 shadow-lg shadow-destructive/25">
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedIds.length})
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 w-full sm:w-auto h-11 bg-card/80 backdrop-blur-sm border-border/50">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              className="gap-2 w-full sm:w-auto h-11 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
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

        {/* Metrics Cards Premium */}
        <div className="grid gap-4 md:gap-6 grid-cols-2 lg:grid-cols-4">
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">movimentações</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Entradas</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center ring-1 ring-success/10">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-success" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-success">{stats?.entries || 0}</div>
              <p className="text-xs text-muted-foreground">registros</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Saídas</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center ring-1 ring-danger/10">
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-danger" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-danger">{stats?.exits || 0}</div>
              <p className="text-xs text-muted-foreground">registros</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Transferências</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <ArrowRightLeft className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-primary">{stats?.transfers || 0}</div>
              <p className="text-xs text-muted-foreground">registros</p>
            </CardContent>
          </Card>
        </div>

        {/* Table Premium */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card overflow-hidden">
          <CardContent className="p-0">
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
              <SortableTableHead sortKey="created_at" currentSort={sortConfig} onSort={handleSort}>Data/Hora</SortableTableHead>
              <SortableTableHead sortKey="type" currentSort={sortConfig} onSort={handleSort}>Tipo</SortableTableHead>
              <SortableTableHead sortKey="products.name" currentSort={sortConfig} onSort={handleSort}>Produto</SortableTableHead>
              <SortableTableHead sortKey="quantity" currentSort={sortConfig} onSort={handleSort}>Quantidade</SortableTableHead>
              <SortableTableHead sortKey="from_location.name" currentSort={sortConfig} onSort={handleSort}>Origem</SortableTableHead>
              <SortableTableHead sortKey="to_location.name" currentSort={sortConfig} onSort={handleSort}>Destino</SortableTableHead>
              <SortableTableHead sortKey="reference" currentSort={sortConfig} onSort={handleSort}>Referência</SortableTableHead>
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
          </CardContent>
        </Card>

      <MovementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        movement={selectedMovement}
      />
      </div>
    </div>
  );
};

export default Movements;
