import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itemId, itemName, itemType, currentPrice, currentCost, currentMargin, salesHistory } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Pegar o usuário autenticado
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    // Buscar organização do usuário
    const { data: orgMember } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!orgMember) {
      throw new Error("Usuário não pertence a nenhuma organização");
    }

    const organizationId = orgMember.organization_id;

    // Buscar movimentações financeiras do item
    const { data: movimentacoes, error: movError } = await supabase
      .from("financeiro")
      .select("*")
      .eq("produto_id", itemId)
      .eq("tipo", "venda")
      .order("data", { ascending: false })
      .limit(100);

    if (movError) {
      console.error("Erro ao buscar movimentações:", movError);
    }

    // Calcular métricas detalhadas
    const totalVendas = movimentacoes?.length || 0;
    const faturamentoTotal = movimentacoes?.reduce((sum, m) => sum + (parseFloat(m.preco_venda?.toString() || "0")), 0) || 0;
    const quantidadeTotal = movimentacoes?.reduce((sum, m) => sum + (parseFloat(m.quantidade?.toString() || "0")), 0) || 0;
    const custoTotal = movimentacoes?.reduce((sum, m) => sum + (parseFloat(m.custo_total?.toString() || "0")), 0) || 0;
    const lucroTotal = faturamentoTotal - custoTotal;
    const margemMedia = faturamentoTotal > 0 ? (lucroTotal / faturamentoTotal) * 100 : 0;

    // Analisar tendência de vendas (últimos 30 dias vs 30 dias anteriores)
    const hoje = new Date();
    const ultimos30Dias = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dias30Anteriores = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000);

    const vendasRecentes = movimentacoes?.filter(m => new Date(m.data) >= ultimos30Dias).length || 0;
    const vendasAnteriores = movimentacoes?.filter(m => 
      new Date(m.data) < ultimos30Dias && new Date(m.data) >= dias30Anteriores
    ).length || 0;

    const crescimentoVendas = vendasAnteriores > 0 
      ? ((vendasRecentes - vendasAnteriores) / vendasAnteriores) * 100 
      : 0;

    // Montar prompt detalhado para a IA
    const prompt = `Você é um consultor financeiro especializado em precificação estratégica.

**DADOS DO PRODUTO/KIT:**
- Nome: ${itemName}
- Tipo: ${itemType === "produto" ? "Produto" : "Kit"}
- Preço atual: R$ ${currentPrice.toFixed(2)}
- Custo total: R$ ${currentCost.toFixed(2)}
- Margem atual: ${currentMargin.toFixed(1)}%

**HISTÓRICO DE VENDAS (últimos registros):**
- Total de vendas registradas: ${totalVendas}
- Faturamento total: R$ ${faturamentoTotal.toFixed(2)}
- Quantidade vendida: ${quantidadeTotal}
- Custo total acumulado: R$ ${custoTotal.toFixed(2)}
- Lucro total: R$ ${lucroTotal.toFixed(2)}
- Margem média: ${margemMedia.toFixed(1)}%

**ANÁLISE DE TENDÊNCIA:**
- Vendas nos últimos 30 dias: ${vendasRecentes}
- Vendas nos 30 dias anteriores: ${vendasAnteriores}
- Crescimento: ${crescimentoVendas > 0 ? "+" : ""}${crescimentoVendas.toFixed(1)}%

**SUA MISSÃO:**
Com base EXCLUSIVAMENTE nesses dados reais, calcule o preço ideal para maximizar o lucro mantendo boa rotatividade.

Você DEVE retornar OBRIGATORIAMENTE no seguinte formato JSON (sem markdown, sem quebras de linha extras):

{
  "preco_recomendado": [número decimal, ex: 150.00],
  "lucro_potencial": [número decimal estimado do lucro mensal com novo preço],
  "impacto_demanda": "[baixo/moderado/alto]",
  "analise_completa": "[texto de 4 a 8 parágrafos explicando a recomendação, por que o preço atual não é ideal (se aplicável), impacto esperado, e orientação final. Use emojis para facilitar leitura. Seja objetivo e profissional, mas use linguagem simples.]"
}

IMPORTANTE:
- Use APENAS os números fornecidos, nunca invente dados
- Considere que margem ideal varia entre 20-40% para produtos de giro rápido, e 40-60% para produtos de giro lento
- Se as vendas estão crescendo, considere aumento moderado de preço
- Se as vendas estão caindo, considere redução de preço ou manter
- Leve em conta o custo total e a rotatividade
- A análise completa deve incentivar tomada de decisão com base em dados`;

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um consultor financeiro especializado em precificação. Sempre retorne respostas em formato JSON válido.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Erro da IA:", aiResponse.status, errorText);
      throw new Error(`Erro ao chamar IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const resposta = aiData.choices[0].message.content;

    let recomendacao;
    try {
      recomendacao = JSON.parse(resposta);
    } catch (e) {
      console.error("Erro ao parsear JSON da IA:", resposta);
      throw new Error("Resposta da IA não está em formato JSON válido");
    }

    // Validar campos obrigatórios
    if (!recomendacao.preco_recomendado || !recomendacao.analise_completa) {
      throw new Error("Resposta da IA incompleta");
    }

    // Salvar recomendação no histórico
    const { data: savedRec, error: saveError } = await supabase
      .from("recomendacoes_preco")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        produto_id: itemId,
        tipo: itemType,
        preco_atual: currentPrice,
        preco_recomendado: recomendacao.preco_recomendado,
        lucro_potencial: recomendacao.lucro_potencial || null,
        impacto_demanda: recomendacao.impacto_demanda || "moderado",
        analise_completa: recomendacao.analise_completa,
        aplicado: false,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Erro ao salvar recomendação:", saveError);
    }

    return new Response(
      JSON.stringify({
        ...recomendacao,
        recomendacao_id: savedRec?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro em calcular-preco-ideal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
