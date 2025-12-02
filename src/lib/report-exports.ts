import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { addPDFHeader, addPDFFooter, addPDFSummary, getPDFTableStyles } from "./pdf-helpers";
import { toast } from "sonner";

export const exportFinancialReport = async (
  organizationId: string,
  dateFrom: Date | null,
  dateTo: Date | null
) => {
  try {
    let query = supabase
      .from("financeiro")
      .select(`
        data,
        tipo,
        descricao,
        valor,
        quantidade,
        custo_total,
        lucro_liquido,
        margem_percentual,
        produto_id,
        products (name, sku)
      `)
      .eq("organization_id", organizationId)
      .order("data", { ascending: false });

    if (dateFrom && dateTo) {
      query = query
        .gte("data", dateFrom.toISOString().split("T")[0])
        .lte("data", dateTo.toISOString().split("T")[0]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalReceita = data?.filter(d => d.tipo === "saida").reduce((acc, d) => acc + Number(d.valor), 0) || 0;
    const totalDespesa = data?.filter(d => d.tipo === "entrada").reduce((acc, d) => acc + Number(d.custo_total || 0), 0) || 0;
    const totalLucro = data?.reduce((acc, d) => acc + Number(d.lucro_liquido || 0), 0) || 0;

    const doc = new jsPDF("landscape");
    const startY = addPDFHeader({
      doc,
      title: "Relatório Financeiro",
      subtitle: dateFrom && dateTo 
        ? `Período: ${dateFrom.toLocaleDateString("pt-BR")} - ${dateTo.toLocaleDateString("pt-BR")}`
        : "Todos os períodos",
      stats: [
        { label: "Receita", value: `R$ ${totalReceita.toFixed(2)}` },
        { label: "Lucro", value: `R$ ${totalLucro.toFixed(2)}` },
      ]
    });

    autoTable(doc, {
      startY,
      head: [["Data", "Tipo", "Descrição", "Produto", "Qtd", "Valor", "Custo", "Lucro", "Margem"]],
      body: data?.map((item: any) => [
        new Date(item.data).toLocaleDateString("pt-BR"),
        item.tipo === "entrada" ? "Compra" : "Venda",
        item.descricao,
        item.products?.name || "-",
        item.quantidade || "-",
        `R$ ${Number(item.valor).toFixed(2)}`,
        `R$ ${Number(item.custo_total || 0).toFixed(2)}`,
        `R$ ${Number(item.lucro_liquido || 0).toFixed(2)}`,
        item.margem_percentual ? `${Number(item.margem_percentual).toFixed(1)}%` : "-",
      ]) || [],
      ...getPDFTableStyles(),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { halign: 'center', cellWidth: 22 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 28 },
        6: { halign: 'right', cellWidth: 28 },
        7: { halign: 'right', cellWidth: 28 },
        8: { halign: 'center', cellWidth: 22 },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    addPDFSummary(doc, finalY, "Resumo Financeiro", [
      { label: "Total de Receita", value: `R$ ${totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "Total de Despesas", value: `R$ ${totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "Lucro Líquido", value: `R$ ${totalLucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "Margem Média", value: totalReceita > 0 ? `${((totalLucro / totalReceita) * 100).toFixed(1)}%` : "0%" },
    ]);

    doc.save(`relatorio_financeiro_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório Financeiro exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};

export const exportAccountsReport = async (
  organizationId: string,
  dateFrom: Date | null,
  dateTo: Date | null
) => {
  try {
    let query = supabase
      .from("contas")
      .select("*")
      .eq("organization_id", organizationId)
      .order("data_vencimento", { ascending: false });

    if (dateFrom && dateTo) {
      query = query
        .gte("data_vencimento", dateFrom.toISOString().split("T")[0])
        .lte("data_vencimento", dateTo.toISOString().split("T")[0]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalPagar = data?.filter(c => c.tipo === "Pagar").reduce((acc, c) => acc + Number(c.valor), 0) || 0;
    const totalReceber = data?.filter(c => c.tipo === "Receber").reduce((acc, c) => acc + Number(c.valor), 0) || 0;
    const pendentes = data?.filter(c => c.status === "Pendente").length || 0;
    const atrasadas = data?.filter(c => c.status === "Atrasado").length || 0;

    const doc = new jsPDF("landscape");
    const startY = addPDFHeader({
      doc,
      title: "Relatório de Contas",
      subtitle: dateFrom && dateTo 
        ? `Período: ${dateFrom.toLocaleDateString("pt-BR")} - ${dateTo.toLocaleDateString("pt-BR")}`
        : "Todos os períodos",
      stats: [
        { label: "Pendentes", value: pendentes },
        { label: "Atrasadas", value: atrasadas },
      ]
    });

    autoTable(doc, {
      startY,
      head: [["Tipo", "Descrição", "Categoria", "Valor", "Vencimento", "Pagamento", "Status"]],
      body: data?.map((conta: any) => [
        conta.tipo,
        conta.descricao,
        conta.categoria,
        `R$ ${Number(conta.valor).toFixed(2)}`,
        new Date(conta.data_vencimento).toLocaleDateString("pt-BR"),
        conta.data_pagamento ? new Date(conta.data_pagamento).toLocaleDateString("pt-BR") : "-",
        conta.status,
      ]) || [],
      ...getPDFTableStyles(),
      columnStyles: {
        0: { halign: 'center', cellWidth: 28 },
        1: { cellWidth: 65 },
        2: { cellWidth: 35 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'center', cellWidth: 28 },
        5: { halign: 'center', cellWidth: 28 },
        6: { halign: 'center', cellWidth: 28 },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    addPDFSummary(doc, finalY, "Resumo de Contas", [
      { label: "Total a Pagar", value: `R$ ${totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "Total a Receber", value: `R$ ${totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
      { label: "Saldo", value: `R$ ${(totalReceber - totalPagar).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
    ]);

    doc.save(`relatorio_contas_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório de Contas exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};

export const exportSuppliersReport = async (organizationId: string) => {
  try {
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("*")
      .eq("organization_id", organizationId);

    if (suppliersError) throw suppliersError;

    const doc = new jsPDF();
    const startY = addPDFHeader({
      doc,
      title: "Relatório de Fornecedores",
      stats: [{ label: "Total", value: suppliers?.length || 0 }]
    });

    autoTable(doc, {
      startY,
      head: [["Nome", "CNPJ", "Contato", "Email", "Telefone", "Status"]],
      body: suppliers?.map((supplier: any) => [
        supplier.name,
        supplier.cnpj || "-",
        supplier.contact || "-",
        supplier.email || "-",
        supplier.phone || "-",
        supplier.active ? "Ativo" : "Inativo",
      ]) || [],
      ...getPDFTableStyles(),
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 },
        4: { cellWidth: 25 },
        5: { halign: 'center', cellWidth: 20 },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    doc.save(`relatorio_fornecedores_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório de Fornecedores exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};

export const exportKitsReport = async (organizationId: string) => {
  try {
    const { data: kits, error: kitsError } = await supabase
      .from("kits")
      .select(`
        *,
        kit_items (
          quantity,
          products (name, sku, cost)
        )
      `)
      .eq("organization_id", organizationId);

    if (kitsError) throw kitsError;

    const doc = new jsPDF("landscape");
    const startY = addPDFHeader({
      doc,
      title: "Relatório de Kits",
      stats: [{ label: "Total de Kits", value: kits?.length || 0 }]
    });

    const kitsData = kits?.map((kit: any) => {
      const totalCost = kit.kit_items?.reduce((acc: number, item: any) => 
        acc + (Number(item.quantity) * Number(item.products?.cost || 0)), 0
      ) || 0;
      const margin = kit.preco_venda 
        ? ((Number(kit.preco_venda) - totalCost) / Number(kit.preco_venda) * 100).toFixed(1)
        : "0";

      return [
        kit.sku,
        kit.name,
        kit.description || "-",
        kit.kit_items?.length || 0,
        `R$ ${totalCost.toFixed(2)}`,
        kit.preco_venda ? `R$ ${Number(kit.preco_venda).toFixed(2)}` : "-",
        `${margin}%`,
        kit.active ? "Ativo" : "Inativo",
      ];
    }) || [];

    autoTable(doc, {
      startY,
      head: [["SKU", "Nome", "Descrição", "Itens", "Custo", "Preço Venda", "Margem", "Status"]],
      body: kitsData,
      ...getPDFTableStyles(),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 45 },
        2: { cellWidth: 60 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 28 },
        6: { halign: 'center', cellWidth: 22 },
        7: { halign: 'center', cellWidth: 22 },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    doc.save(`relatorio_kits_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório de Kits exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};

export const exportCriticalStockReport = async (organizationId: string) => {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select(`
        *,
        categories (name),
        locations (name),
        suppliers (name)
      `)
      .eq("organization_id", organizationId);

    if (error) throw error;

    const criticalProducts = products?.filter(p => Number(p.quantity) <= Number(p.min_quantity)) || [];
    const zeroStock = criticalProducts.filter(p => Number(p.quantity) === 0);
    const lowStock = criticalProducts.filter(p => Number(p.quantity) > 0);

    const doc = new jsPDF("landscape");
    const startY = addPDFHeader({
      doc,
      title: "Relatório de Estoque Crítico",
      stats: [
        { label: "Críticos", value: criticalProducts.length },
        { label: "Zerados", value: zeroStock.length },
      ]
    });

    autoTable(doc, {
      startY,
      head: [["SKU", "Produto", "Categoria", "Qtd Atual", "Qtd Mínima", "Status", "Local", "Fornecedor"]],
      body: criticalProducts.map((product: any) => [
        product.sku,
        product.name,
        product.categories?.name || "-",
        product.quantity,
        product.min_quantity,
        Number(product.quantity) === 0 ? "SEM ESTOQUE" : "CRÍTICO",
        product.locations?.name || "-",
        product.suppliers?.name || "-",
      ]),
      ...getPDFTableStyles(),
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 50 },
        2: { cellWidth: 35 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'center', cellWidth: 28 },
        6: { cellWidth: 35 },
        7: { cellWidth: 38 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const cellValue = data.cell.raw as string;
          if (cellValue === "SEM ESTOQUE") {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (cellValue === "CRÍTICO") {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const estimatedLoss = criticalProducts.reduce((acc, p) => 
      acc + (Number(p.preco_venda || 0) * Number(p.min_quantity)), 0
    );

    addPDFSummary(doc, finalY, "Resumo de Estoque Crítico", [
      { label: "Produtos Críticos", value: criticalProducts.length },
      { label: "Produtos Zerados", value: zeroStock.length },
      { label: "Produtos em Nível Baixo", value: lowStock.length },
      { label: "Perda Potencial Estimada", value: `R$ ${estimatedLoss.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
    ]);

    doc.save(`relatorio_estoque_critico_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório de Estoque Crítico exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};

export const exportPerformanceReport = async (
  organizationId: string,
  dateFrom: Date | null,
  dateTo: Date | null
) => {
  try {
    let financeiroQuery = supabase
      .from("financeiro")
      .select("*")
      .eq("organization_id", organizationId);

    let movementsQuery = supabase
      .from("movements")
      .select("*")
      .eq("organization_id", organizationId);

    if (dateFrom && dateTo) {
      financeiroQuery = financeiroQuery
        .gte("data", dateFrom.toISOString().split("T")[0])
        .lte("data", dateTo.toISOString().split("T")[0]);
      
      movementsQuery = movementsQuery
        .gte("created_at", dateFrom.toISOString())
        .lte("created_at", dateTo.toISOString());
    }

    const [{ data: financeiro }, { data: movements }, { data: products }] = await Promise.all([
      financeiroQuery,
      movementsQuery,
      supabase.from("products").select("quantity, cost, preco_venda").eq("organization_id", organizationId)
    ]);

    const totalVendas = financeiro?.filter(f => f.tipo === "saida").reduce((acc, f) => acc + Number(f.valor), 0) || 0;
    const totalCompras = financeiro?.filter(f => f.tipo === "entrada").reduce((acc, f) => acc + Number(f.custo_total || 0), 0) || 0;
    const totalLucro = financeiro?.reduce((acc, f) => acc + Number(f.lucro_liquido || 0), 0) || 0;
    const margemMedia = totalVendas > 0 ? ((totalLucro / totalVendas) * 100).toFixed(1) : "0";
    const valorEstoque = products?.reduce((acc, p) => acc + (Number(p.quantity) * Number(p.cost)), 0) || 0;
    const totalMovimentos = movements?.length || 0;

    const doc = new jsPDF("landscape");
    const startY = addPDFHeader({
      doc,
      title: "Relatório de Performance",
      subtitle: dateFrom && dateTo 
        ? `Período: ${dateFrom.toLocaleDateString("pt-BR")} - ${dateTo.toLocaleDateString("pt-BR")}`
        : "Todos os períodos",
    });

    const performanceData = [
      ["Receita Total", `R$ ${totalVendas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Despesas Totais", `R$ ${totalCompras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Lucro Líquido", `R$ ${totalLucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Margem Média", `${margemMedia}%`],
      ["Valor em Estoque", `R$ ${valorEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Total de Movimentos", totalMovimentos.toString()],
      ["Ticket Médio", totalVendas > 0 ? `R$ ${(totalVendas / (financeiro?.filter(f => f.tipo === "saida").length || 1)).toFixed(2)}` : "R$ 0,00"],
      ["ROI", totalCompras > 0 ? `${((totalLucro / totalCompras) * 100).toFixed(1)}%` : "0%"],
    ];

    autoTable(doc, {
      startY,
      head: [["Métrica", "Valor"]],
      body: performanceData,
      ...getPDFTableStyles(),
      columnStyles: {
        0: { cellWidth: 100, fontStyle: 'bold' },
        1: { halign: 'right', cellWidth: 100, fontSize: 10, fontStyle: 'bold', textColor: [30, 64, 175] },
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        addPDFFooter(doc, data.pageNumber, pageCount);
      },
    });

    doc.save(`relatorio_performance_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("Relatório de Performance exportado com sucesso");
  } catch (error: any) {
    toast.error(error.message || "Erro ao exportar relatório");
    throw error;
  }
};
