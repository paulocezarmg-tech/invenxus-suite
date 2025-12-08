import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, Package, TrendingDown, AlertCircle, DollarSign, ImageIcon, Filter, X, Download, FileSpreadsheet, FileText } from "lucide-react";
import { ProductDialog } from "@/components/products/ProductDialog";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { formatNumber, formatCurrency } from "@/lib/formatters";
import { SortableTableHead, useSorting } from "@/components/shared/SortableTableHead";
import * as XLSX from "xlsx";

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { data: organizationId } = useOrganization();

  // Check user role - get highest privilege role
  const { data: currentUser, isLoading: isLoadingRole } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (rolesData && rolesData.length > 0) {
        // Determine highest privilege role
        const roleHierarchy = {
          superadmin: 4,
          admin: 3,
          almoxarife: 2,
          auditor: 1,
          operador: 0
        };
        
        const highestRole = rolesData.reduce((highest, current) => {
          const currentLevel = roleHierarchy[current.role as keyof typeof roleHierarchy] || 0;
          const highestLevel = roleHierarchy[highest as keyof typeof roleHierarchy] || 0;
          return currentLevel > highestLevel ? current.role : highest;
        }, rolesData[0].role);
        
        console.log("Products - User highest role:", highestRole);
        setUserRole(highestRole);
      }
      return user;
    },
  });

  // Listen for realtime changes to user_roles
  useEffect(() => {
    let channel: any;
    
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      channel = supabase
        .channel('user-roles-products')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_roles',
            filter: `user_id=eq.${data.user.id}`
          },
          () => {
            console.log('User roles changed, refetching...');
            queryClient.invalidateQueries({ queryKey: ["current-user"] });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  // Listen for realtime changes to products
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          console.log('Products changed, refetching...');
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["product-stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Stats query
  const { data: stats } = useQuery({
    queryKey: ["product-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return { total: 0, critical: 0, outOfStock: 0, totalValue: 0 };
      
      const { data, error } = await supabase
        .from("products")
        .select("quantity, min_quantity, cost")
        .eq("organization_id", organizationId);
      
      if (error) throw error;
      
      const total = data?.length || 0;
      const critical = data?.filter(p => p.quantity <= p.min_quantity).length || 0;
      const outOfStock = data?.filter(p => p.quantity === 0).length || 0;
      const totalValue = data?.reduce((sum, p) => sum + (Number(p.cost) * Number(p.quantity)), 0) || 0;
      
      return { total, critical, outOfStock, totalValue };
    },
    enabled: !!organizationId,
  });

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ["categories", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ["locations", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", searchTerm, categoryFilter, locationFilter, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from("products")
        .select(`
          *,
          categories (name),
          locations (name),
          suppliers (name)
        `)
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });

      if (searchTerm) {
        query = query.or(
          `name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`
        );
      }

      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      if (locationFilter !== "all") {
        query = query.eq("location_id", locationFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  // Apply stock filter client-side
  const products = productsData?.filter(p => {
    if (stockFilter === "all") return true;
    if (stockFilter === "critical") return p.quantity <= p.min_quantity && p.quantity > 0;
    if (stockFilter === "out") return p.quantity === 0;
    if (stockFilter === "normal") return p.quantity > p.min_quantity;
    return true;
  });

  // Sorting hook
  const { sortConfig, handleSort, sortedData: sortedProducts } = useSorting(products, "name", "asc");

  const hasActiveFilters = categoryFilter !== "all" || locationFilter !== "all" || stockFilter !== "all";

  const clearFilters = () => {
    setCategoryFilter("all");
    setLocationFilter("all");
    setStockFilter("all");
  };

  const getStockBadge = (quantity: number, minQuantity: number) => {
    if (quantity === 0) {
      return <Badge variant="danger">Sem Estoque</Badge>;
    } else if (quantity <= minQuantity) {
      return <Badge variant="warning">Crítico</Badge>;
    } else {
      return <Badge variant="success">Normal</Badge>;
    }
  };

  const getStatusText = (quantity: number, minQuantity: number) => {
    if (quantity === 0) return "Sem Estoque";
    if (quantity <= minQuantity) return "Crítico";
    return "Normal";
  };

  const exportToExcel = () => {
    if (!sortedProducts || sortedProducts.length === 0) {
      toast.error("Não há produtos para exportar");
      return;
    }

    const dataToExport = sortedProducts.map((p: any) => ({
      SKU: p.sku || "",
      Nome: p.name || "",
      Descrição: p.description || "",
      Categoria: p.categories?.name || "",
      Quantidade: Number(p.quantity) || 0,
      "Qtd. Mínima": Number(p.min_quantity) || 0,
      Unidade: p.unit || "",
      Localização: p.locations?.name || "",
      Fornecedor: p.suppliers?.name || "",
      "Custo (R$)": Number(p.cost) || 0,
      "Preço Venda (R$)": Number(p.preco_venda) || 0,
      "Código de Barras": p.barcode || "",
      Status: getStatusText(Number(p.quantity), Number(p.min_quantity)),
      Ativo: p.active ? "Sim" : "Não",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");

    // Auto-size columns
    const colWidths = Object.keys(dataToExport[0]).map(key => ({
      wch: Math.max(key.length, ...dataToExport.map(row => String(row[key as keyof typeof row]).length))
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `produtos-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Arquivo Excel exportado com sucesso!");
  };

  const exportToCSV = () => {
    if (!sortedProducts || sortedProducts.length === 0) {
      toast.error("Não há produtos para exportar");
      return;
    }

    const headers = [
      "SKU", "Nome", "Descrição", "Categoria", "Quantidade", "Qtd. Mínima",
      "Unidade", "Localização", "Fornecedor", "Custo (R$)", "Preço Venda (R$)",
      "Código de Barras", "Status", "Ativo"
    ];

    const rows = sortedProducts.map((p: any) => [
      p.sku || "",
      p.name || "",
      (p.description || "").replace(/"/g, '""'),
      p.categories?.name || "",
      Number(p.quantity) || 0,
      Number(p.min_quantity) || 0,
      p.unit || "",
      p.locations?.name || "",
      p.suppliers?.name || "",
      Number(p.cost) || 0,
      Number(p.preco_venda) || 0,
      p.barcode || "",
      getStatusText(Number(p.quantity), Number(p.min_quantity)),
      p.active ? "Sim" : "Não",
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `produtos-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Arquivo CSV exportado com sucesso!");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;

    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;

      toast.success("Produto excluído");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir produto");
    }
  };

  const handleDeleteMultiple = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} produto(s)?`)) return;

    try {
      const { error } = await supabase.from("products").delete().in("id", selectedIds);
      if (error) throw error;

      toast.success("Produtos excluídos com sucesso");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product-stats"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir produtos");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === products?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products?.map(p => p.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };


  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="p-6 md:p-8 space-y-6 md:space-y-8 animate-fade-in">
        {/* Header Premium */}
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Produtos</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  Gerenciar catálogo de produtos
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {selectedIds.length > 0 && userRole === "superadmin" && (
              <Button onClick={handleDeleteMultiple} variant="destructive" className="h-11 gap-2 shadow-lg shadow-destructive/25">
                <Trash2 className="h-4 w-4" />
                Excluir ({selectedIds.length})
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-success" />
                  Exportar Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-primary" />
                  Exportar CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button
              className="h-11 gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
              onClick={() => {
                setSelectedProduct(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Metrics Cards Premium */}
        <div className={`grid gap-4 md:gap-6 ${userRole === "operador" ? "md:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total de Produtos</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                <Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight">{stats?.total || 0}</div>
              <p className="text-xs text-muted-foreground">itens cadastrados</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Estoque Crítico</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center ring-1 ring-warning/10">
                <AlertCircle className="h-5 w-5 md:h-6 md:w-6 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-warning">{stats?.critical || 0}</div>
              <p className="text-xs text-muted-foreground">produtos em alerta</p>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
            <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sem Estoque</CardTitle>
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center ring-1 ring-danger/10">
                <TrendingDown className="h-5 w-5 md:h-6 md:w-6 text-danger" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl md:text-4xl font-bold tracking-tight text-danger">{stats?.outOfStock || 0}</div>
              <p className="text-xs text-muted-foreground">produtos zerados</p>
            </CardContent>
          </Card>

          {userRole && userRole !== "operador" && (
            <Card className="group relative overflow-hidden border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs md:text-sm font-semibold text-muted-foreground uppercase tracking-wide">Valor Total</CardTitle>
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center ring-1 ring-success/10">
                  <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-success" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-xl md:text-3xl font-bold tracking-tight text-success">
                  R$ {(stats?.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">em estoque</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Search and Filters */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              
              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span className="font-medium">Filtros:</span>
                </div>
                
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] h-10 bg-background/50 border-border/50">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[180px] h-10 bg-background/50 border-border/50">
                    <SelectValue placeholder="Localização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as localizações</SelectItem>
                    {locations?.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={stockFilter} onValueChange={setStockFilter}>
                  <SelectTrigger className="w-[160px] h-10 bg-background/50 border-border/50">
                    <SelectValue placeholder="Status estoque" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="out">Sem Estoque</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="h-10 gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                    Limpar filtros
                  </Button>
                )}

                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-auto">
                    {sortedProducts?.length || 0} resultado(s)
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Table View Premium */}
        <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card hidden md:block overflow-hidden">
          <CardContent className="p-0">
            <div className="rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {userRole === "superadmin" && (
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.length === sortedProducts?.length && sortedProducts?.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="min-w-[60px]">Imagem</TableHead>
                  <SortableTableHead sortKey="sku" currentSort={sortConfig} onSort={handleSort} className="min-w-[100px]">
                    SKU
                  </SortableTableHead>
                  <SortableTableHead sortKey="name" currentSort={sortConfig} onSort={handleSort} className="min-w-[150px]">
                    Nome
                  </SortableTableHead>
                  <SortableTableHead sortKey="categories.name" currentSort={sortConfig} onSort={handleSort} className="min-w-[120px]">
                    Categoria
                  </SortableTableHead>
                  <SortableTableHead sortKey="quantity" currentSort={sortConfig} onSort={handleSort} className="min-w-[80px]">
                    Qtd.
                  </SortableTableHead>
                  <SortableTableHead sortKey="min_quantity" currentSort={sortConfig} onSort={handleSort} className="min-w-[80px]">
                    Mín.
                  </SortableTableHead>
                  <SortableTableHead sortKey="locations.name" currentSort={sortConfig} onSort={handleSort} className="min-w-[150px]">
                    Local
                  </SortableTableHead>
                  {userRole && userRole !== "operador" && (
                    <SortableTableHead sortKey="cost" currentSort={sortConfig} onSort={handleSort} className="min-w-[100px]">
                      Custo
                    </SortableTableHead>
                  )}
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  {userRole === "superadmin" && <TableHead className="min-w-[100px]">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={userRole === "superadmin" ? 11 : 10} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : sortedProducts && sortedProducts.length > 0 ? (
                  sortedProducts.map((product: any) => (
                    <TableRow key={product.id}>
                      {userRole === "superadmin" && (
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(product.id)}
                            onCheckedChange={() => handleSelectOne(product.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{product.name}</div>
                          {product.barcode && (
                            <div className="text-xs text-muted-foreground font-mono">{product.barcode}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{product.categories?.name || "N/A"}</TableCell>
                      <TableCell className="font-medium text-sm">{formatNumber(Number(product.quantity))}</TableCell>
                      <TableCell className="text-sm">{formatNumber(Number(product.min_quantity))}</TableCell>
                      <TableCell className="text-sm">{product.locations?.name || "N/A"}</TableCell>
                      {userRole && userRole !== "operador" && (
                        <TableCell className="text-sm whitespace-nowrap">R$ {Number(product.cost).toFixed(2)}</TableCell>
                      )}
                      <TableCell>{getStockBadge(Number(product.quantity), Number(product.min_quantity))}</TableCell>
                      {userRole === "superadmin" && (
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedProduct(product);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(product.id)}
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
                    <TableCell colSpan={userRole === "superadmin" ? 11 : 10} className="text-center text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

        {/* Mobile Cards View Premium */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card">
              <CardContent className="p-6 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span>Carregando...</span>
                </div>
              </CardContent>
            </Card>
          ) : sortedProducts && sortedProducts.length > 0 ? (
            sortedProducts.map((product: any) => (
              <Card key={product.id} className="group border-0 bg-card/80 backdrop-blur-sm shadow-card hover:shadow-elevated transition-all duration-300">
                <CardContent className="p-4 space-y-3">
                  {product.image_url && (
                    <div className="w-full aspect-video rounded-xl overflow-hidden bg-muted ring-1 ring-border/50">
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">SKU: {product.sku}</div>
                      {product.barcode && (
                        <div className="text-xs text-muted-foreground font-mono">Código: {product.barcode}</div>
                      )}
                    </div>
                    {getStockBadge(Number(product.quantity), Number(product.min_quantity))}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-xl p-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Categoria</div>
                      <div className="font-medium truncate">{product.categories?.name || "N/A"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Qtd.</div>
                      <div className="font-bold text-primary">{formatNumber(Number(product.quantity))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Mín.</div>
                      <div className="font-medium">{formatNumber(Number(product.min_quantity))}</div>
                    </div>
                    {userRole && userRole !== "operador" && (
                      <div>
                        <div className="text-xs text-muted-foreground">Custo</div>
                        <div className="font-medium text-success">R$ {Number(product.cost).toFixed(2)}</div>
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/30 rounded-xl p-3">
                    <div className="text-xs text-muted-foreground">Local</div>
                    <div className="font-medium text-sm">{product.locations?.name || "N/A"}</div>
                  </div>

                  {userRole === "superadmin" && (
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-card/50 hover:bg-primary hover:text-primary-foreground transition-all"
                        onClick={() => {
                          setSelectedProduct(product);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-card/50 hover:bg-destructive hover:text-destructive-foreground transition-all"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-0 bg-card/80 backdrop-blur-sm shadow-card">
              <CardContent className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <span className="text-muted-foreground">Nenhum produto encontrado</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct}
      />
    </div>
  );
};

export default Products;
