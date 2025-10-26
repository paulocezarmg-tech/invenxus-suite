import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Movements = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimentações</h1>
          <p className="text-muted-foreground">
            Registrar entradas, saídas e transferências
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Movimentação
        </Button>
      </div>

      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p>Página em desenvolvimento</p>
      </div>
    </div>
  );
};

export default Movements;
