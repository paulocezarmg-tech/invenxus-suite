import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WeeklyStats {
  totalMovements: number;
  criticalProducts: number;
  zeroStockProducts: number;
  totalValue: number;
  weekRevenue?: number;
  weekProfit?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting weekly report generation...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all organizations
    const { data: organizations, error: orgsError } = await supabaseClient
      .from('organizations')
      .select('id, name')
      .eq('active', true);

    if (orgsError) {
      console.error('Error fetching organizations:', orgsError);
      throw orgsError;
    }

    console.log(`Found ${organizations?.length || 0} organizations to process`);

    let totalNotifications = 0;

    // Process each organization
    for (const org of organizations || []) {
      console.log(`Processing organization: ${org.name} (${org.id})`);

      try {
        // Calculate date range (last 7 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        // Get weekly statistics
        const stats: WeeklyStats = {
          totalMovements: 0,
          criticalProducts: 0,
          zeroStockProducts: 0,
          totalValue: 0,
        };

        // Count movements in the last week
        const { count: movementsCount } = await supabaseClient
          .from('movements')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        stats.totalMovements = movementsCount || 0;

        // Get critical products
        const { data: products } = await supabaseClient
          .from('products')
          .select('quantity, min_quantity, cost')
          .eq('organization_id', org.id)
          .eq('active', true);

        if (products) {
          stats.criticalProducts = products.filter(p => p.quantity <= p.min_quantity && p.quantity > 0).length;
          stats.zeroStockProducts = products.filter(p => p.quantity === 0).length;
          stats.totalValue = products.reduce((sum, p) => sum + (Number(p.quantity) * Number(p.cost)), 0);
        }

        // Get financial data for the week (if admin has access)
        const { data: financeiroData } = await supabaseClient
          .from('financeiro')
          .select('tipo, valor, lucro_liquido')
          .eq('organization_id', org.id)
          .gte('data', startDate.toISOString().split('T')[0])
          .lte('data', endDate.toISOString().split('T')[0]);

        if (financeiroData) {
          stats.weekRevenue = financeiroData
            .filter(f => f.tipo === 'saida')
            .reduce((sum, f) => sum + Number(f.valor || 0), 0);
          
          stats.weekProfit = financeiroData
            .filter(f => f.tipo === 'saida')
            .reduce((sum, f) => sum + Number(f.lucro_liquido || 0), 0);
        }

        // Create notification message
        const formatCurrency = (value: number) => {
          return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(value);
        };

        let message = `📊 Relatório Semanal (${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')})\n\n`;
        message += `📦 Movimentações: ${stats.totalMovements}\n`;
        message += `⚠️ Produtos Críticos: ${stats.criticalProducts}\n`;
        message += `🔴 Produtos Sem Estoque: ${stats.zeroStockProducts}\n`;
        message += `💰 Valor Total em Estoque: ${formatCurrency(stats.totalValue)}`;

        if (stats.weekRevenue !== undefined && stats.weekProfit !== undefined) {
          message += `\n\n💵 Faturamento Semanal: ${formatCurrency(stats.weekRevenue)}`;
          message += `\n📈 Lucro Semanal: ${formatCurrency(stats.weekProfit)}`;
        }

        // Get all admins and superadmins from this organization
        const { data: adminUsers } = await supabaseClient
          .from('organization_members')
          .select(`
            user_id,
            user_roles!inner (
              role
            )
          `)
          .eq('organization_id', org.id);

        if (!adminUsers || adminUsers.length === 0) {
          console.log(`No admin users found for organization ${org.name}`);
          continue;
        }

        // Filter to only get admins and superadmins
        const adminUserIds = adminUsers
          .filter((member: any) => {
            const roles = member.user_roles;
            return roles && (roles.role === 'admin' || roles.role === 'superadmin');
          })
          .map((member: any) => member.user_id);

        console.log(`Found ${adminUserIds.length} admin users for organization ${org.name}`);

        // Create notification for each admin/superadmin
        for (const userId of adminUserIds) {
          const { error: notifError } = await supabaseClient
            .from('notifications')
            .insert({
              organization_id: org.id,
              user_id: userId,
              title: '📊 Relatório Semanal Disponível',
              message: message,
              type: 'info',
              read: false,
            });

          if (notifError) {
            console.error(`Error creating notification for user ${userId}:`, notifError);
          } else {
            totalNotifications++;
            console.log(`Notification created for user ${userId}`);
          }
        }

      } catch (orgError) {
        console.error(`Error processing organization ${org.name}:`, orgError);
      }
    }

    const result = {
      success: true,
      message: `Relatórios semanais gerados com sucesso. ${totalNotifications} notificações criadas.`,
      organizations_processed: organizations?.length || 0,
      notifications_created: totalNotifications,
    };

    console.log('Weekly report generation completed:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Weekly report generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
