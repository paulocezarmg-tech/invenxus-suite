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
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-organization", {
        body: {
          organizationName: name,
          organizationSlug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          adminName,
          adminEmail,
          adminPhone,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organização e administrador criados com sucesso! Email enviado.");
      setName("");
      setSlug("");
      setAdminName("");
      setAdminEmail("");
      setAdminPhone("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar organização");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug || !adminName || !adminEmail) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      toast.error("Email inválido");
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
            Crie uma nova organização e cadastre o primeiro administrador
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Empresa ABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (identificador único) *</Label>
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
            
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Dados do Administrador</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nome do Administrador *</Label>
                  <Input
                    id="adminName"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email do Administrador *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Ex: admin@empresaabc.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPhone">Telefone</Label>
                  <Input
                    id="adminPhone"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Ex: (11) 98765-4321"
                  />
                </div>
              </div>
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
