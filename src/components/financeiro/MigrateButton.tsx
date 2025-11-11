import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function MigrateButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleMigrate = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'migrate-movements-to-financeiro'
      );

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        // Reload the page to show new data
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(data.error || "Erro ao migrar movimentações");
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      toast.error(error.message || "Erro ao migrar movimentações");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Migrar Movimentações
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Migrar Movimentações para Financeiro</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá importar todas as movimentações de entrada e saída existentes 
            para o financeiro, calculando automaticamente os valores de custo, venda e lucro.
            <br /><br />
            Movimentações já migradas serão ignoradas automaticamente.
            <br /><br />
            Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleMigrate} disabled={isLoading}>
            {isLoading ? "Migrando..." : "Confirmar Migração"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
