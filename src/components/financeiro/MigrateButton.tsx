import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export function MigrateButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [migrationType, setMigrationType] = useState<"products" | "kits">("products");
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const handleMigrate = async () => {
    setIsLoading(true);
    setShowProgress(true);
    setMigrationResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke(
        'migrate-movements-to-financeiro',
        {
          body: { type: migrationType }
        }
      );

      if (error) throw error;

      setMigrationResult(data);
      
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error || "Erro ao migrar movimentações");
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      setMigrationResult({ 
        success: false, 
        error: error.message || "Erro ao migrar movimentações",
        stats: { total: 0, created: 0, skipped: 0, errors: 0 }
      });
      toast.error(error.message || "Erro ao migrar movimentações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseProgress = () => {
    setShowProgress(false);
    if (migrationResult?.success && migrationResult?.stats?.created > 0) {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <>
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
            <AlertDialogDescription className="space-y-4">
              <p>
                Esta ação irá importar movimentações de entrada e saída existentes 
                para o financeiro, calculando automaticamente os valores de custo, venda e lucro.
              </p>
              <p className="text-sm text-muted-foreground">
                Movimentações já migradas serão ignoradas automaticamente.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Migração:</label>
                <Select value={migrationType} onValueChange={(value: "products" | "kits") => setMigrationType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">Apenas Produtos</SelectItem>
                    <SelectItem value="kits">Apenas Kits</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMigrate} disabled={isLoading}>
              {isLoading ? "Iniciando..." : "Confirmar Migração"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Migrando Movimentações...
                </>
              ) : migrationResult?.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Migração Concluída
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Erro na Migração
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isLoading ? (
                "Processando movimentações, aguarde..."
              ) : migrationResult?.success ? (
                "A migração foi concluída com sucesso!"
              ) : (
                "Ocorreu um erro durante a migração."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoading && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  Migrando {migrationType === "products" ? "produtos" : "kits"}...
                </p>
              </div>
            )}

            {migrationResult && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">
                      {migrationResult.stats?.total || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-success/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-success">
                      {migrationResult.stats?.created || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Criados</p>
                  </div>
                  <div className="bg-warning/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-warning">
                      {migrationResult.stats?.skipped || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Ignorados</p>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">
                      {migrationResult.stats?.errors || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>

                {migrationResult.message && (
                  <div className="text-sm text-center p-3 bg-muted rounded-lg">
                    {migrationResult.message}
                  </div>
                )}

                {migrationResult.error && (
                  <div className="text-sm text-center p-3 bg-destructive/10 text-destructive rounded-lg">
                    {migrationResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isLoading && (
            <div className="flex justify-end">
              <Button onClick={handleCloseProgress}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
