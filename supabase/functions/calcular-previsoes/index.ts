import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const { organization_id } = await req.json();

    console.log("Iniciando cálculo de previsões para organização:", organization_id);

    // Buscar todos os produtos da organização
    const { data: produtos, error: produtosError } = await supabaseClient
      .from("products")
      .select("id, name, quantity, min_quantity, organization_id, preco_venda, cost")
      .eq("organization_id", organization_id)
      .eq("active", true);

    if (produtosError) throw produtosError;

    console.log(`Encontrados ${produtos?.length || 0} produtos`);

    const previsoes = [];
    const dataHoje = new Date();
    const data30DiasAtras = new Date(dataHoje);
    data30DiasAtras.setDate(data30DiasAtras.getDate() - 30);

    for (const produto of produtos || []) {
      // Buscar movimentações DIRETAS de saída do produto
      const { data: movimentosDiretos, error: movimentosError } = await supabaseClient
        .from("movements")
        .select("quantity, created_at")
        .eq("product_id", produto.id)
        .eq("type", "OUT")
        .order("created_at", { ascending: true });

      if (movimentosError) {
        console.error(`Erro ao buscar movimentos diretos do produto ${produto.id}:`, movimentosError);
        continue;
      }

      // Buscar movimentações INDIRETAS via kits
      const { data: movimentosKits, error: kitsError } = await supabaseClient
        .from("movements")
        .select(`
          quantity,
          created_at,
          kit_id,
          kits!inner(id)
        `)
        .eq("type", "OUT")
        .not("kit_id", "is", null);

      if (kitsError) {
        console.error(`Erro ao buscar movimentos de kits:`, kitsError);
      }

      // Buscar itens do kit que contém este produto
      const { data: kitItems, error: kitItemsError } = await supabaseClient
        .from("kit_items")
        .select("kit_id, quantity")
        .eq("product_id", produto.id);

      if (kitItemsError) {
        console.error(`Erro ao buscar kit_items do produto ${produto.id}:`, kitItemsError);
      }

      // Combinar movimentos diretos e indiretos
      const movimentos = [...(movimentosDiretos || [])];

      // Adicionar movimentos indiretos (via kits)
      if (movimentosKits && kitItems) {
        for (const movKit of movimentosKits) {
          const kitItem = kitItems.find(ki => ki.kit_id === movKit.kit_id);
          if (kitItem) {
            // Multiplicar a quantidade do movimento pela quantidade do produto no kit
            movimentos.push({
              quantity: Number(movKit.quantity) * Number(kitItem.quantity),
              created_at: movKit.created_at
            });
          }
        }
      }

      // Ordenar todos os movimentos por data
      movimentos.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Calcular média de vendas diárias
      let totalVendas = 0;
      const diasComVendas = new Set();
      let primeiraVenda: Date | null = null;
      let ultimaVenda: Date | null = null;

      if (movimentos && movimentos.length > 0) {
        for (const mov of movimentos) {
          totalVendas += Number(mov.quantity);
          const dataVenda = new Date(mov.created_at);
          const dia = dataVenda.toISOString().split("T")[0];
          diasComVendas.add(dia);
          
          if (!primeiraVenda || dataVenda < primeiraVenda) {
            primeiraVenda = dataVenda;
          }
          if (!ultimaVenda || dataVenda > ultimaVenda) {
            ultimaVenda = dataVenda;
          }
        }
      }

      // Calcular número de dias entre primeira e última venda
      let diasPeriodo = 1;
      if (primeiraVenda && ultimaVenda) {
        const diffTime = Math.abs(ultimaVenda.getTime() - primeiraVenda.getTime());
        diasPeriodo = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1); // Mínimo 1 dia
      }

      // Se houver movimentações mas todas no mesmo dia, usar 1 dia
      if (movimentos && movimentos.length > 0 && diasPeriodo === 0) {
        diasPeriodo = 1;
      }

      // Usar o período real de vendas para calcular a média
      const mediaVendasDiaria = diasPeriodo > 0 && totalVendas > 0 ? totalVendas / diasPeriodo : 0;
      const estoqueAtual = Number(produto.quantity);

      console.log(`Produto ${produto.name}: ${movimentos?.length || 0} movimentações, Total vendas: ${totalVendas}, Período: ${diasPeriodo} dias, Média: ${mediaVendasDiaria.toFixed(2)}/dia`);

      let diasRestantes = null;
      let perdaFinanceira = 0;
      let recomendacao = "Sem movimentações de saída registradas. Não é possível calcular previsão.";

      // Calcular preço de venda e custo
      const precoVenda = Number(produto.preco_venda || 0);
      const precoCusto = Number(produto.cost || 0);
      const lucroUnitario = precoVenda - precoCusto;

      if (movimentos && movimentos.length === 0) {
        recomendacao = `O produto ${produto.name} ainda não possui movimentações de saída. Comece a registrar saídas para gerar previsões automáticas.`;
      } else if (mediaVendasDiaria > 0) {
        diasRestantes = estoqueAtual / mediaVendasDiaria;

        // Calcular perda financeira se dias restantes < 10
        if (diasRestantes < 10) {
          perdaFinanceira = mediaVendasDiaria * precoVenda * diasRestantes;
        }

        // Calcular data estimada de reabastecimento
        const dataReposicao = new Date(dataHoje);
        dataReposicao.setDate(dataReposicao.getDate() + Math.floor(diasRestantes));
        const dataReposicaoFormatada = dataReposicao.toLocaleDateString("pt-BR");

        // Usar IA para gerar recomendação com análise financeira
        const prompt = `Você é uma assistente de gestão de estoque e finanças inteligente.
Analise os dados abaixo e gere uma recomendação breve e objetiva.

Dados:
- Produto: ${produto.name}
- Estoque atual: ${estoqueAtual.toFixed(2)} unidades
- Média de vendas diária: ${mediaVendasDiaria.toFixed(2)} unidades
- Dias restantes: ${diasRestantes.toFixed(0)} dias
- Preço de venda: R$ ${precoVenda.toFixed(2)}
- Lucro unitário: R$ ${lucroUnitario.toFixed(2)}
- Perda financeira estimada: R$ ${perdaFinanceira.toFixed(2)}

Gere uma resposta breve no formato:
"O produto ${produto.name} está com ${estoqueAtual.toFixed(0)} unidades e uma média de ${mediaVendasDiaria.toFixed(1)} saídas por dia. Prevemos que o estoque acabará em ${diasRestantes.toFixed(0)} dias (${dataReposicaoFormatada}). ${perdaFinanceira > 0 ? `A falta deste produto pode representar uma perda de aproximadamente R$ ${perdaFinanceira.toFixed(2)}.` : ''} Recomendamos reabastecer o quanto antes."

Seja conciso e objetivo.`;

        try {
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
                  role: "user",
                  content: prompt,
                },
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            recomendacao = aiData.choices[0]?.message?.content || recomendacao;
          } else {
            console.error("Erro na resposta da IA:", await aiResponse.text());
          }
        } catch (aiError) {
          console.error("Erro ao chamar IA:", aiError);
        }
      }

      previsoes.push({
        produto_id: produto.id,
        estoque_atual: estoqueAtual,
        media_vendas_diaria: mediaVendasDiaria,
        dias_restantes: diasRestantes,
        perda_financeira: perdaFinanceira,
        data_previsao: new Date().toISOString(),
        recomendacao: recomendacao,
        organization_id: produto.organization_id,
      });
    }

    // Deletar previsões antigas da organização
    await supabaseClient
      .from("previsoes_estoque")
      .delete()
      .eq("organization_id", organization_id);

    // Inserir novas previsões
    if (previsoes.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("previsoes_estoque")
        .insert(previsoes);

      if (insertError) throw insertError;
    }

    console.log(`Previsões calculadas com sucesso: ${previsoes.length} produtos`);

    return new Response(
      JSON.stringify({
        success: true,
        total: previsoes.length,
        previsoes: previsoes.slice(0, 5), // Retorna apenas os 5 primeiros para preview
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao calcular previsões:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});