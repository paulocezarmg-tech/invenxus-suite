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
    const { type = 'products', movementType = 'all' } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log(`Starting migration of ${type} movements (${movementType}) to financeiro...`);

    // Get movements filtered by type
    let query = supabaseClient
      .from('movements')
      .select('*')
      .order('created_at', { ascending: true });
    
    // Filter by movement type (IN/OUT/both)
    if (movementType === 'in') {
      query = query.eq('type', 'IN');
      console.log('Query will fetch only IN movements (compras)');
    } else if (movementType === 'out') {
      query = query.eq('type', 'OUT');
      console.log('Query will fetch only OUT movements (vendas)');
    } else {
      query = query.in('type', ['IN', 'OUT']);
      console.log('Query will fetch both IN and OUT movements');
    }

    // Filter by product or kit
    if (type === 'products') {
      query = query.not('product_id', 'is', null);
    } else if (type === 'kits') {
      query = query.not('kit_id', 'is', null);
    }

    const { data: movements, error: movementsError } = await query;

    if (movementsError) {
      console.error('Error fetching movements:', movementsError);
      throw movementsError;
    }

    console.log(`Found ${movements?.length || 0} movements to migrate`);
    
    // Log breakdown of movement types
    const inCount = movements?.filter(m => m.type === 'IN').length || 0;
    const outCount = movements?.filter(m => m.type === 'OUT').length || 0;
    console.log(`Breakdown: ${inCount} IN movements, ${outCount} OUT movements`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const movement of movements || []) {
      console.log(`Processing movement ${movement.id} - Type: ${movement.type}, Quantity: ${movement.quantity}`);
      try {
        // Check if already migrated by checking description pattern
        const migrationDescription = movement.type === 'IN' ? 'Entrada - ' : 'Saída - ';
        const { data: existing } = await supabaseClient
          .from('financeiro')
          .select('id')
          .eq('data', new Date(movement.created_at).toISOString().split('T')[0])
          .eq('tipo', movement.type === 'IN' ? 'entrada' : 'saida')
          .eq('quantidade', movement.quantity)
          .ilike('descricao', `${migrationDescription}%Migração`)
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
          
          console.log(`Movement ${movement.id}: Type=${movement.type}, Custo=${custoUnitario}, Qty=${quantity}, CustoTotal=${custoTotal}, Valor=${valorTotal}`);

          const financeiroData = {
            tipo: movement.type === "IN" ? "entrada" : "saida",
            data: new Date(movement.created_at).toISOString().split('T')[0],
            descricao: `${movement.type === "IN" ? "Entrada" : "Saída"} - ${itemName}${movement.reference ? ` (${movement.reference})` : ""} - Migração`,
            produto_id: null, // Don't use foreign key - just store description
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
            console.log(`Successfully migrated ${movement.type} movement ${movement.id} - ${itemName} (Qty: ${quantity}, Valor: ${valorTotal})`);
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
