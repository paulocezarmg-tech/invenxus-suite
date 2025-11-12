import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileUp, X, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  tipo: z.enum(["Pagar", "Receber"]),
  descricao: z.string().min(3, "Descrição deve ter no mínimo 3 caracteres"),
  categoria: z.string().min(2, "Categoria é obrigatória"),
  valor: z.string().min(1, "Valor é obrigatório"),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  status: z.enum(["Pendente", "Pago", "Atrasado"]),
  data_pagamento: z.string().optional(),
});

interface ContasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta?: any;
  onSuccess: () => void;
}

const categorias = [
  "Fornecedor",
  "Venda",
  "Taxas",
  "Aluguel",
  "Salários",
  "Serviços",
  "Utilities",
  "Outros"
];

export function ContasDialog({
  open,
  onOpenChange,
  conta,
  onSuccess,
}: ContasDialogProps) {
  const { toast } = useToast();
  const [anexos, setAnexos] = useState<Array<{ name: string; url: string; path: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: "Pagar",
      descricao: "",
      categoria: "",
      valor: "",
      data_vencimento: new Date().toISOString().split("T")[0],
      status: "Pendente",
      data_pagamento: "",
    },
  });

  useEffect(() => {
    if (conta) {
      form.reset({
        tipo: conta.tipo,
        descricao: conta.descricao,
        categoria: conta.categoria,
        valor: conta.valor.toString(),
        data_vencimento: conta.data_vencimento,
        status: conta.status,
        data_pagamento: conta.data_pagamento || "",
      });
      // Carregar anexos existentes
      if (conta.anexos && Array.isArray(conta.anexos)) {
        setAnexos(conta.anexos);
      } else {
        setAnexos([]);
      }
    } else {
      form.reset({
        tipo: "Pagar",
        descricao: "",
        categoria: "",
        valor: "",
        data_vencimento: new Date().toISOString().split("T")[0],
        status: "Pendente",
        data_pagamento: "",
      });
      setAnexos([]);
    }
  }, [conta, form]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) throw new Error("Organização não encontrada");

      const uploadedFiles: Array<{ name: string; url: string; path: string }> = [];

      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${orgMember.organization_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('conta-documentos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('conta-documentos')
          .getPublicUrl(filePath);

        uploadedFiles.push({
          name: file.name,
          url: publicUrl,
          path: filePath,
        });
      }

      setAnexos([...anexos, ...uploadedFiles]);
      toast({
        title: "Arquivos enviados",
        description: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = async (index: number) => {
    try {
      const fileToRemove = anexos[index];
      
      const { error } = await supabase.storage
        .from('conta-documentos')
        .remove([fileToRemove.path]);

      if (error) throw error;

      const newAnexos = anexos.filter((_, i) => i !== index);
      setAnexos(newAnexos);

      toast({
        title: "Arquivo removido",
        description: "O arquivo foi removido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = async (anexo: { name: string; url: string; path: string }) => {
    try {
      const { data, error } = await supabase.storage
        .from('conta-documentos')
        .download(anexo.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erro ao baixar arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!orgMember) throw new Error("Organização não encontrada");

      const payload = {
        tipo: values.tipo,
        descricao: values.descricao,
        categoria: values.categoria,
        valor: parseFloat(values.valor),
        data_vencimento: values.data_vencimento,
        status: values.status,
        data_pagamento: values.data_pagamento || null,
        user_id: user.id,
        organization_id: orgMember.organization_id,
        anexos: anexos,
      };

      if (conta) {
        const { error } = await supabase
          .from("contas")
          .update(payload)
          .eq("id", conta.id);

        if (error) throw error;

        toast({
          title: "Conta atualizada",
          description: "A conta foi atualizada com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("contas")
          .insert([payload]);

        if (error) throw error;

        toast({
          title: "Conta registrada",
          description: "A conta foi registrada com sucesso!",
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {conta ? "Editar Conta" : "Nova Conta"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pagar">Contas a Pagar</SelectItem>
                      <SelectItem value="Receber">Contas a Receber</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a conta..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoria"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_vencimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Vencimento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Pago">Pago</SelectItem>
                      <SelectItem value="Atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("status") === "Pago" && (
              <FormField
                control={form.control}
                name="data_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Pagamento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="space-y-2">
              <FormLabel>Anexos (Boletos, Comprovantes, etc.)</FormLabel>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={uploadingFile}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  {uploadingFile ? "Enviando..." : "Adicionar Arquivo"}
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {anexos.length > 0 && (
                <div className="space-y-2 mt-3">
                  {anexos.map((anexo, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{anexo.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadFile(anexo)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {conta ? "Atualizar" : "Salvar Conta"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
