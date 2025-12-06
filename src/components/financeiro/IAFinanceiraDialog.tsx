import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Download, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IAFinanceiraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string;
  endDate: string;
}

type TonalityType = "profissional" | "motivacional" | "extrovertido" | "serio";

const TONALITY_LABELS: Record<TonalityType, string> = {
  profissional: "Profissional",
  motivacional: "Motivacional",
  extrovertido: "Extrovertido",
  serio: "Sério"
};

export const IAFinanceiraDialog = ({ open, onOpenChange, startDate, endDate }: IAFinanceiraDialogProps) => {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [tonality, setTonality] = useState<TonalityType>("profissional");
  const { toast } = useToast();

  const generateAnalysis = async (selectedTonality: TonalityType = tonality) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-analise-ia", {
        body: {
          startDate,
          endDate,
          tonality: selectedTonality
        }
      });

      if (error) {
        if (error.message?.includes("429")) {
          throw new Error("Limite de requisições atingido. Por favor, aguarde alguns instantes e tente novamente.");
        }
        if (error.message?.includes("402")) {
          throw new Error("Créditos insuficientes. Por favor, adicione créditos em Settings → Workspace → Usage.");
        }
        throw error;
      }

      if (data?.analysis) {
        setAnalysis(data.analysis);
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error("Erro ao gerar análise");
      }
    } catch (error: any) {
      console.error("Erro ao gerar análise:", error);
      toast({
        title: "Erro ao gerar análise",
        description: error.message || "Ocorreu um erro ao processar a análise. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !analysis) {
      generateAnalysis();
    }
    onOpenChange(newOpen);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(analysis);
    toast({
      title: "Análise copiada",
      description: "A análise foi copiada para a área de transferência.",
    });
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);

      // Título
      doc.setFontSize(18);
      doc.setTextColor(16, 185, 129);
      doc.text("Análise Financeira por IA", pageWidth / 2, 20, { align: "center" });

      // Período
      doc.setFontSize(10);
      doc.setTextColor(100);
      const formatPdfDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "N/A";
        return format(date, "dd/MM/yyyy", { locale: ptBR });
      };
      const periodo = `Período: ${formatPdfDate(startDate)} a ${formatPdfDate(endDate)}`;
      doc.text(periodo, pageWidth / 2, 28, { align: "center" });

      // Data de geração
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 34, { align: "center" });

      // Conteúdo da análise
      doc.setFontSize(11);
      doc.setTextColor(40);
      
      const lines = doc.splitTextToSize(analysis, maxWidth);
      let currentY = 50;
      
      lines.forEach((line: string) => {
        if (currentY > pageHeight - margin) {
          doc.addPage();
          currentY = margin;
        }
        doc.text(line, margin, currentY);
        currentY += 7;
      });

      const fileName = `analise-ia-financeira-${format(new Date(), "dd-MM-yyyy-HHmm")}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF exportado",
        description: `O arquivo ${fileName} foi baixado.`,
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleTonalityChange = (newTonality: TonalityType) => {
    setTonality(newTonality);
    generateAnalysis(newTonality);
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return "Data não definida";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Data inválida";
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            IA Financeira — Insight Automático
          </DialogTitle>
          <DialogDescription>
            Análise inteligente baseada nos dados reais do período de{" "}
            {formatDateSafe(startDate)} a {formatDateSafe(endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-4 border-y border-border">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-sm font-medium whitespace-nowrap">Tom da análise:</label>
            <Select value={tonality} onValueChange={handleTonalityChange} disabled={isLoading}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TONALITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => generateAnalysis()} 
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refazer análise
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Gerando análise inteligente...</p>
              <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          ) : analysis ? (
            <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
              {analysis.split('\n\n').map((paragraph, index) => (
                <p key={index} className="text-foreground leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Nenhuma análise disponível</p>
            </div>
          )}
        </div>

        {analysis && !isLoading && (
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar análise
            </Button>
            <Button variant="default" onClick={exportToPDF}>
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
