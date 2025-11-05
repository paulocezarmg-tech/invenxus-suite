import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface OrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationDialog({ open, onOpenChange }: OrganizationDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("organizations")
        .insert({
          name,
          slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organização criada com sucesso");
      setName("");
      setSlug("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar organização");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error("Preencha todos os campos");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Organização</DialogTitle>
          <DialogDescription>
            Crie uma nova organização para um cliente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Empresa ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (identificador único)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Ex: empresa-abc"
              />
              <p className="text-xs text-muted-foreground">
                Use apenas letras minúsculas, números e hífens
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Criar Organização
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
