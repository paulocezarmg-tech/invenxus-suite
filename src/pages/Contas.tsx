import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ContasDialog } from "@/components/contas/ContasDialog";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, CheckCircle, AlertCircle, DollarSign, TrendingUp, TrendingDown, Clock, Paperclip, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { formatCurrency } from "@/lib/formatters";

export default function Contas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { toast } = useToast();
  const { userRole, isAdmin, isSuperAdmin, isLoading: isLoadingRole } = useUserRole();

  // Redirect if not admin or superadmin
  if (!isLoadingRole && !isAdmin() && !isSuperAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Esta funcionalidade está disponível apenas para administradores.
          </p>
        </div>
      </div>
    );
  }

  if (isLoadingRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const handleDateChange = (from: Date | null, to: Date | null) => {
    setDateRange({ from: from || undefined, to: to || undefined });
  };

  const { data: contas, refetch } = useQuery({
    queryKey: ["contas", dateRange, tipoFilter, statusFilter, categoriaFilter],
    queryFn: async () => {
      let query = supabase
        .from("contas")
        .select("*")
        .order("data_vencimento", { ascending: true });

      if (dateRange.from) {
        query = query.gte("data_vencimento", dateRange.from.toISOString().split("T")[0]);
      }
      if (dateRange.to) {
        query = query.lte("data_vencimento", dateRange.to.toISOString().split("T")[0]);
      }
      if (tipoFilter !== "all") {
        query = query.eq("tipo", tipoFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoriaFilter !== "all") {
        query = query.eq("categoria", categoriaFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data;
    },
  });

  // Update overdue status on mount
  useEffect(() => {
    const updateOverdueStatus = async () => {
      const { error } = await supabase.rpc('update_contas_status');
      if (!error) {
        refetch();
      }
    };
    updateOverdueStatus();
  }, []); // Run only once on mount

  const categorias = [...new Set(contas?.map(c => c.categoria) || [])];

  const totalReceber = contas
    ?.filter(c => c.tipo === "Receber" && c.status === "Pendente")
    ?.reduce((sum, c) => sum + parseFloat(c.valor.toString()), 0) || 0;

  const totalPagar = contas
    ?.filter(c => c.tipo === "Pagar" && c.status === "Pendente")
    ?.reduce((sum, c) => sum + parseFloat(c.valor.toString()), 0) || 0;

  const totalVencidas = contas
    ?.filter(c => c.status === "Atrasado")
    ?.reduce((sum, c) => sum + parseFloat(c.valor.toString()), 0) || 0;

  const totalPagas = contas
    ?.filter(c => c.status === "Pago")
    ?.reduce((sum, c) => sum + parseFloat(c.valor.toString()), 0) || 0;

  const contasVencendoEmBreve = contas?.filter(c => {
    if (c.status !== "Pendente") return false;
    const diff = differenceInDays(parseISO(c.data_vencimento), new Date());
    return diff >= 0 && diff <= 1;
  });

  const handleDelete = async (id: string) => {
    if (!isAdmin() && !isSuperAdmin()) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir contas.",
        variant: "destructive",
      });
      return;
    }

    if (confirm("Tem certeza que deseja excluir esta conta?")) {
      const { error } = await supabase.from("contas").delete().eq("id", id);

      if (error) {
        toast({
          title: "Erro ao excluir",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Conta excluída",
          description: "A conta foi excluída com sucesso.",
        });
        refetch();
      }
    }
  };

  const handleDeleteMultiple = async () => {
    if (!isAdmin() && !isSuperAdmin()) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem excluir contas.",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Tem certeza que deseja excluir ${selectedIds.length} conta(s)?`)) {
      const { error } = await supabase.from("contas").delete().in("id", selectedIds);

      if (error) {
        toast({
          title: "Erro ao excluir",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Contas excluídas",
          description: "As contas foram excluídas com sucesso.",
        });
        setSelectedIds([]);
        refetch();
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === contas?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contas?.map(c => c.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleMarkAsPaid = async (conta: any) => {
    const { error } = await supabase
      .from("contas")
      .update({
        status: "Pago",
        data_pagamento: new Date().toISOString().split("T")[0],
      })
      .eq("id", conta.id);

    if (error) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Conta marcada como paga",
        description: "O status foi atualizado com sucesso.",
      });
      refetch();
    }
  };

  const handleSendAlerts = async () => {
    try {
      toast({
        title: "Enviando alertas...",
        description: "Processando contas a vencer.",
      });

      const { data, error } = await supabase.functions.invoke("enviar-alertas-contas");

      if (error) throw error;

      toast({
        title: "Alertas enviados!",
        description: data.message || "Notificações enviadas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar alertas",
        description: error.message,
        variant: "destructive",
      });
    }
  };


  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", className: string }> = {
      Pago: { variant: "default", className: "bg-green-600 hover:bg-green-700" },
      Pendente: { variant: "secondary", className: "bg-yellow-600 hover:bg-yellow-700" },
      Atrasado: { variant: "destructive", className: "bg-red-600 hover:bg-red-700" },
    };

    return (
      <Badge variant={variants[status].variant} className={variants[status].className}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8 space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:justify-between md:items-start">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Contas a Pagar e Receber</h1>
            <p className="text-base text-muted-foreground">
              Organize seus compromissos financeiros e acompanhe vencimentos
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSendAlerts} className="h-11">
              <Bell className="mr-2 h-4 w-4" />
              Enviar Alertas
            </Button>
            {selectedIds.length > 0 && (
              <Button onClick={handleDeleteMultiple} variant="destructive" className="h-11">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir ({selectedIds.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setSelectedConta(null);
                setDialogOpen(true);
              }}
              className="h-11"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </div>
        </div>

        {contasVencendoEmBreve && contasVencendoEmBreve.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-5 w-5 text-warning" />
            <AlertDescription className="text-sm font-medium">
              Você possui {contasVencendoEmBreve.length} conta(s) vencendo em breve!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contas a Receber
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {formatCurrency(totalReceber)}
              </div>
              <p className="text-sm text-muted-foreground">Valores pendentes</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contas a Pagar
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {formatCurrency(totalPagar)}
              </div>
              <p className="text-sm text-muted-foreground">Valores pendentes</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contas Vencidas
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight text-warning">
                {formatCurrency(totalVencidas)}
              </div>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-card hover:shadow-elevated transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Pagas/Recebidas
              </CardTitle>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {formatCurrency(totalPagas)}
              </div>
              <p className="text-sm text-muted-foreground">Total pago</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="Pagar">Pagar</SelectItem>
                <SelectItem value="Receber">Receber</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DateRangeFilter onDateChange={handleDateChange} />
          </div>
        </CardContent>
      </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Lista de Contas</CardTitle>
          </CardHeader>
          <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {(isAdmin() || isSuperAdmin()) && (
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === contas?.length && contas?.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Vencimento</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas?.map((conta) => (
                <TableRow key={conta.id}>
                  {(isAdmin() || isSuperAdmin()) && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(conta.id)}
                        onCheckedChange={() => handleSelectOne(conta.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    {format(parseISO(conta.data_vencimento), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={conta.tipo === "Receber" ? "default" : "secondary"}>
                      {conta.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{conta.descricao}</span>
                      {conta.anexos && Array.isArray(conta.anexos) && conta.anexos.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          <Paperclip className="h-3 w-3" />
                          {conta.anexos.length}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{conta.categoria}</TableCell>
                  <TableCell>{formatCurrency(parseFloat(conta.valor.toString()))}</TableCell>
                  <TableCell>{getStatusBadge(conta.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {conta.status !== "Pago" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleMarkAsPaid(conta)}
                          title="Marcar como Pago"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedConta(conta);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(conta.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ContasDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conta={selectedConta}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
          setSelectedConta(null);
        }}
      />
      </div>
    </div>
  );
}
