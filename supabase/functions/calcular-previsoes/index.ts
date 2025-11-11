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
      .select("id, name, quantity, min_quantity, organization_id")
      .eq("organization_id", organization_id)
      .eq("active", true);

    if (produtosError) throw produtosError;

    console.log(`Encontrados ${produtos?.length || 0} produtos`);

    const previsoes = [];
    const dataHoje = new Date();
    const data30DiasAtras = new Date(dataHoje);
    data30DiasAtras.setDate(data30DiasAtras.getDate() - 30);

    for (const produto of produtos || []) {
      // Buscar TODAS as movimentações de saída do produto
      const { data: movimentos, error: movimentosError } = await supabaseClient
        .from("movements")
        .select("quantity, created_at")
        .eq("product_id", produto.id)
        .eq("type", "OUT")
        .order("created_at", { ascending: true });

      if (movimentosError) {
        console.error(`Erro ao buscar movimentos do produto ${produto.id}:`, movimentosError);
        continue;
      }

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
      let recomendacao = "Sem movimentações de saída registradas. Não é possível calcular previsão.";

      if (movimentos && movimentos.length === 0) {
        recomendacao = `O produto ${produto.name} ainda não possui movimentações de saída. Comece a registrar saídas para gerar previsões automáticas.`;
      } else if (mediaVendasDiaria > 0) {
        diasRestantes = estoqueAtual / mediaVendasDiaria;

        // Calcular data estimada de reabastecimento
        const dataReposicao = new Date(dataHoje);
        dataReposicao.setDate(dataReposicao.getDate() + Math.floor(diasRestantes));
        const dataReposicaoFormatada = dataReposicao.toLocaleDateString("pt-BR");

        // Usar IA para gerar recomendação
        const prompt = `Você é uma assistente de gestão de estoque inteligente.
Analise os dados abaixo e gere uma recomendação breve e objetiva para o gestor.

Dados:
- Produto: ${produto.name}
- Estoque atual: ${estoqueAtual.toFixed(2)} unidades
- Média diária de saída: ${mediaVendasDiaria.toFixed(2)} unidades
- Dias restantes estimados: ${diasRestantes.toFixed(0)} dias

Gere uma resposta curta e direta no formato:
"Seu produto [NOME] tem [X] unidades restantes e uma média de [Y] saídas por dia. Prevemos que o estoque acabará em [Z] dias. Recomendamos reabastecer até [DATA]."

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