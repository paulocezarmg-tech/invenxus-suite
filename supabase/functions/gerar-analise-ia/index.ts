import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate, tonality = "profissional" } = await req.json();

    // Verificar se as datas são válidas
    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Período inválido" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter token do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Buscar dados do usuário para obter organization_id
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter organization_id
    const { data: orgMember } = await supabaseClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!orgMember) {
      return new Response(
        JSON.stringify({ error: "Organização não encontrada" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = orgMember.organization_id;

    // Buscar dados financeiros
    const { data: financialData, error: finError } = await supabaseClient
      .from('financeiro')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: true });

    if (finError) {
      console.error("Erro ao buscar dados financeiros:", finError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar dados financeiros" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se há dados suficientes
    if (!financialData || financialData.length === 0) {
      return new Response(
        JSON.stringify({ 
          analysis: "Não houve movimentações suficientes para gerar uma análise no período selecionado." 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar produtos para enriquecer a análise
    const { data: products } = await supabaseClient
      .from('products')
      .select('id, name, sku, custo_unitario, preco_venda')
      .eq('organization_id', organizationId)
      .eq('active', true);

    // Calcular métricas do período atual
    const vendas = financialData.filter(item => item.tipo === 'saida');
    const totalFaturamento = vendas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const totalCusto = financialData.reduce((sum, item) => sum + Number(item.custo_total || 0), 0);
    const lucroLiquido = totalFaturamento - totalCusto;
    const margemMedia = totalFaturamento > 0 ? (lucroLiquido / totalFaturamento) * 100 : 0;

    // Calcular período anterior para comparação
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    
    const prevStartDate = new Date(startDateObj);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
    const prevEndDate = new Date(endDateObj);
    prevEndDate.setDate(prevEndDate.getDate() - daysDiff);

    const { data: prevFinancialData } = await supabaseClient
      .from('financeiro')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('data', prevStartDate.toISOString().split('T')[0])
      .lte('data', prevEndDate.toISOString().split('T')[0]);

    const prevVendas = prevFinancialData?.filter(item => item.tipo === 'saida') || [];
    const prevFaturamento = prevVendas.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const prevCusto = prevFinancialData?.reduce((sum, item) => sum + Number(item.custo_total || 0), 0) || 0;
    const prevLucro = prevFaturamento - prevCusto;

    // Calcular crescimento
    const crescimentoFaturamento = prevFaturamento > 0 ? ((totalFaturamento - prevFaturamento) / prevFaturamento) * 100 : 0;
    const crescimentoLucro = prevLucro > 0 ? ((lucroLiquido - prevLucro) / prevLucro) * 100 : 0;

    // Produtos mais lucrativos
    const produtosPorLucro: Record<string, { lucro: number; vendas: number; nome: string; margem: number }> = {};
    
    vendas.forEach(venda => {
      const produtoId = venda.produto_id || venda.descricao;
      const produto = products?.find(p => p.id === venda.produto_id);
      const nome = produto?.name || venda.descricao;
      const lucro = Number(venda.lucro_liquido || 0);
      const valorVenda = Number(venda.valor || 0);
      const margem = valorVenda > 0 ? (lucro / valorVenda) * 100 : 0;

      if (!produtosPorLucro[produtoId]) {
        produtosPorLucro[produtoId] = { lucro: 0, vendas: 0, nome, margem: 0 };
      }
      
      produtosPorLucro[produtoId].lucro += lucro;
      produtosPorLucro[produtoId].vendas += valorVenda;
      produtosPorLucro[produtoId].margem = produtosPorLucro[produtoId].vendas > 0 
        ? (produtosPorLucro[produtoId].lucro / produtosPorLucro[produtoId].vendas) * 100 
        : 0;
    });

    const produtosOrdenados = Object.values(produtosPorLucro).sort((a, b) => b.lucro - a.lucro);
    const top3Lucrativos = produtosOrdenados.slice(0, 3);
    const piores3 = produtosOrdenados.slice(-3).reverse();

    // Análise de custos adicionais
    const custosAdicionais: Record<string, number> = {};
    financialData.forEach(item => {
      if (item.custos_adicionais && Array.isArray(item.custos_adicionais)) {
        item.custos_adicionais.forEach((custo: any) => {
          const tipo = custo.tipo || 'Outros';
          const valor = Number(custo.valor || 0);
          custosAdicionais[tipo] = (custosAdicionais[tipo] || 0) + valor;
        });
      }
    });

    const custosOrdenados = Object.entries(custosAdicionais)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Definir tom da análise
    const tonalityPrompts = {
      profissional: "Seja profissional, direto e baseado em dados. Use linguagem corporativa mas acessível.",
      motivacional: "Seja motivacional e entusiasmado. Use emojis 🎯💪📈 e destaque conquistas e potenciais.",
      extrovertido: "Seja extrovertido, empolgado e use emojis 🚀✨🔥. Celebre sucessos e incentive ação.",
      serio: "Seja sério, formal e técnico. Foque em números e análises profundas sem emojis."
    };

    // Montar prompt para a IA
    const prompt = `Você é um analista financeiro expert. Analise os dados abaixo e gere um relatório detalhado e em linguagem simples.

Tom: ${tonalityPrompts[tonality as keyof typeof tonalityPrompts]}

DADOS DO PERÍODO (${startDate} a ${endDate}):
- Faturamento Total: R$ ${totalFaturamento.toFixed(2)}
- Custos Totais: R$ ${totalCusto.toFixed(2)}
- Lucro Líquido: R$ ${lucroLiquido.toFixed(2)}
- Margem Média: ${margemMedia.toFixed(1)}%
- Número de Vendas: ${vendas.length}

COMPARAÇÃO COM PERÍODO ANTERIOR:
- Faturamento Anterior: R$ ${prevFaturamento.toFixed(2)}
- Crescimento Faturamento: ${crescimentoFaturamento.toFixed(1)}%
- Lucro Anterior: R$ ${prevLucro.toFixed(2)}
- Crescimento Lucro: ${crescimentoLucro.toFixed(1)}%

TOP 3 PRODUTOS MAIS LUCRATIVOS:
${top3Lucrativos.map((p, i) => `${i + 1}. ${p.nome} - Lucro: R$ ${p.lucro.toFixed(2)} - Margem: ${p.margem.toFixed(1)}%`).join('\n')}

PRODUTOS COM PIOR DESEMPENHO:
${piores3.map((p, i) => `${i + 1}. ${p.nome} - Lucro: R$ ${p.lucro.toFixed(2)} - Margem: ${p.margem.toFixed(1)}%`).join('\n')}

CUSTOS ADICIONAIS MAIS RELEVANTES:
${custosOrdenados.map(([tipo, valor]) => `- ${tipo}: R$ ${valor.toFixed(2)}`).join('\n') || 'Nenhum custo adicional registrado'}

INSTRUÇÕES:
Gere um texto bem estruturado (6-12 parágrafos) contendo:
1. Resumo geral do período
2. Comparação com período anterior (interpretação de crescimento ou queda)
3. Análise dos produtos mais lucrativos
4. Análise dos produtos com pior desempenho
5. Custos que mais consumiram lucro
6. Oportunidades para aumentar lucro
7. Avisos importantes (se houver quedas ou aumentos anormais)
8. Super recomendação final (call to action inteligente)

Use os números reais fornecidos. Não seja genérico. Seja específico e prático.`;

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Configuração da IA não encontrada" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro da IA:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Por favor, aguarde alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Por favor, adicione créditos." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`Erro na API da IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    return new Response(
      JSON.stringify({ analysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao gerar análise:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao gerar análise" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
