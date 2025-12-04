import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - NOW REQUIRES INVITE ID for security
const AcceptInviteExistingUserSchema = z.object({
  inviteId: z.string().uuid({ message: "ID do convite inválido" }),
  email: z.string().email({ message: "Email inválido" }).max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const body = await req.json();
    const validationResult = AcceptInviteExistingUserSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(", ");
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { inviteId, email, password, name } = validationResult.data;

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // CRITICAL SECURITY FIX: Validate invite exists and matches the email
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.error('Invite not found:', inviteId);
      return new Response(
        JSON.stringify({ success: false, error: 'Convite não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify the invite email matches the provided email
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      console.error('Email mismatch for invite:', inviteId);
      return new Response(
        JSON.stringify({ success: false, error: 'Email não corresponde ao convite' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Check invite status
    if (invite.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Este convite já foi usado ou cancelado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check invite expiration
    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este convite expirou' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user exists
    const { data: existingUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar usuário existente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const user = existingUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Update user password and metadata
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        password: password,
        user_metadata: { name: name }
      }
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar senha do usuário' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Update invite status to accepted
    const { error: updateInviteError } = await supabaseAdmin
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteId);

    if (updateInviteError) {
      console.error('Error updating invite status:', updateInviteError);
    }

    console.log('Existing user invite accepted for:', user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: user.id,
        message: 'Senha atualizada com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in accept-invite-existing-user:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro ao processar solicitação' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
};

serve(handler);
