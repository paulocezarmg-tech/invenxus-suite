import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CustoAdicional {
  descricao: string;
  valor: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting migration of movements to financeiro...');

    // Get all IN and OUT movements
    const { data: movements, error: movementsError } = await supabaseClient
      .from('movements')
      .select('*')
      .in('type', ['IN', 'OUT'])
      .order('created_at', { ascending: true });

    if (movementsError) {
      console.error('Error fetching movements:', movementsError);
      throw movementsError;
    }

    console.log(`Found ${movements?.length || 0} movements to migrate`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const movement of movements || []) {
      try {
        // Check if already migrated (check if there's a financeiro record with same date, type, and quantity)
        const { data: existing } = await supabaseClient
          .from('financeiro')
          .select('id')
          .eq('data', new Date(movement.created_at).toISOString().split('T')[0])
          .eq('tipo', movement.type === 'IN' ? 'entrada' : 'saida')
          .eq('quantidade', movement.quantity)
          .eq('produto_id', movement.product_id || movement.kit_id)
          .maybeSingle();

        if (existing) {
          console.log(`Movement ${movement.id} already migrated, skipping`);
          skipCount++;
          continue;
        }

        let itemData = null;
        let itemName = "";
        let custoUnitario = 0;
        let precoVenda = 0;

        if (movement.product_id) {
          const { data: product } = await supabaseClient
            .from("products")
            .select("name, custo_unitario, preco_venda")
            .eq("id", movement.product_id)
            .single();
          
          if (product) {
            itemData = product;
            itemName = product.name;
            custoUnitario = Number(product.custo_unitario) || 0;
            precoVenda = Number(product.preco_venda) || 0;
          }
        } else if (movement.kit_id) {
          const { data: kit } = await supabaseClient
            .from("kits")
            .select(`
              name,
              preco_venda,
              custos_adicionais,
              kit_items (
                quantity,
                products (custo_unitario)
              )
            `)
            .eq("id", movement.kit_id)
            .single();
          
          if (kit) {
            itemData = kit;
            itemName = kit.name;
            precoVenda = Number(kit.preco_venda) || 0;

            // Calculate kit cost from components
            let kitCost = 0;
            if (kit.kit_items) {
              for (const item of kit.kit_items as any[]) {
                const productCost = Number(item.products?.custo_unitario) || 0;
                kitCost += productCost * Number(item.quantity);
              }
            }

            // Add additional costs
            if (kit.custos_adicionais && Array.isArray(kit.custos_adicionais)) {
              for (const custo of kit.custos_adicionais as unknown as CustoAdicional[]) {
                kitCost += Number(custo.valor) || 0;
              }
            }

            custoUnitario = kitCost;
          }
        }

        if (itemData) {
          const quantity = Number(movement.quantity);
          const custoTotal = custoUnitario * quantity;
          const valorTotal = movement.type === "OUT" ? precoVenda * quantity : custoTotal;
          const lucroLiquido = movement.type === "OUT" ? (precoVenda - custoUnitario) * quantity : 0;
          const margemPercentual = movement.type === "OUT" && precoVenda > 0 
            ? ((precoVenda - custoUnitario) / precoVenda) * 100 
            : 0;

          const financeiroData = {
            tipo: movement.type === "IN" ? "entrada" : "saida",
            data: new Date(movement.created_at).toISOString().split('T')[0],
            descricao: `${movement.type === "IN" ? "Entrada" : "Saída"} - ${itemName}${movement.reference ? ` (${movement.reference})` : ""} - Migração`,
            produto_id: movement.product_id || movement.kit_id,
            quantidade: quantity,
            custo_total: custoTotal,
            preco_venda: precoVenda,
            valor: valorTotal,
            lucro_liquido: lucroLiquido,
            margem_percentual: margemPercentual,
            custos_adicionais: [],
            user_id: movement.created_by,
            organization_id: movement.organization_id,
          };

          const { error: insertError } = await supabaseClient
            .from("financeiro")
            .insert(financeiroData);

          if (insertError) {
            console.error(`Error inserting financeiro for movement ${movement.id}:`, insertError);
            errorCount++;
          } else {
            console.log(`Successfully migrated movement ${movement.id}`);
            successCount++;
          }
        } else {
          console.log(`No item data found for movement ${movement.id}, skipping`);
          skipCount++;
        }
      } catch (error) {
        console.error(`Error processing movement ${movement.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Migração concluída: ${successCount} criados, ${skipCount} já existiam, ${errorCount} erros`,
      stats: {
        total: movements?.length || 0,
        created: successCount,
        skipped: skipCount,
        errors: errorCount
      }
    };

    console.log('Migration completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
