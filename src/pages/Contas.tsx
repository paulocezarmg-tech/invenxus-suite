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
import { ContasDialog } from "@/components/contas/ContasDialog";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, CheckCircle, AlertCircle, DollarSign, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

export default function Contas() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConta, setSelectedConta] = useState<any>(null);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
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

  // Update overdue status
  useEffect(() => {
    const updateOverdueStatus = async () => {
      const { error } = await supabase.rpc('update_contas_status');
      if (!error) {
        refetch();
      }
    };
    updateOverdueStatus();
  }, [refetch]);

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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Contas a Pagar e Receber</h1>
          <p className="text-muted-foreground">
            Organize seus compromissos financeiros e acompanhe vencimentos
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedConta(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      {contasVencendoEmBreve && contasVencendoEmBreve.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⚠️ Você possui {contasVencendoEmBreve.length} conta(s) vencendo em breve!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalReceber.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalPagar.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Vencidas</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              R$ {totalVencidas.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Atrasadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagas/Recebidas</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalPagas.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total pago</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Lista de Contas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell>{conta.descricao}</TableCell>
                  <TableCell>{conta.categoria}</TableCell>
                  <TableCell>R$ {parseFloat(conta.valor.toString()).toFixed(2)}</TableCell>
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
  );
}
