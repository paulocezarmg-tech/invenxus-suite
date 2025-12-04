import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const AcceptInviteSchema = z.object({
  inviteId: z.string().uuid({ message: "ID do convite inválido" }),
  name: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa"),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const body = await req.json();
    const validationResult = AcceptInviteSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(", ");
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { inviteId, name, password } = validationResult.data;

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

    // Get invite details
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

    if (invite.status !== 'pending') {
      return new Response(
        JSON.stringify({ success: false, error: 'Este convite já foi usado ou cancelado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este convite expirou' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers.users.find(u => u.email === invite.email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user
      const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
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

      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        email_confirm: true,
        user_metadata: { name: name }
      });

      if (createError) {
        console.error('Error creating user:', createError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar usuário' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!newUser.user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar usuário' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      userId = newUser.user.id;
      isNewUser = true;
    }

    // Check if organization_member exists
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', invite.organization_id)
      .maybeSingle();

    // Create organization_member if it doesn't exist
    if (!existingMember) {
      const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_id: invite.organization_id,
        });

      if (memberError) {
        console.error('Organization member error:', memberError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao vincular usuário à organização' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Check if profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: userId,
          name: name,
          organization_id: invite.organization_id,
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar perfil do usuário' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else {
      // Update profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          name: name,
          organization_id: invite.organization_id,
        })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }
    }

    // Check if role exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', invite.role)
      .maybeSingle();

    // Assign role if it doesn't exist
    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: invite.role,
        });

      if (roleError) {
        console.error('Role error:', roleError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao atribuir permissões ao usuário' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Update invite status
    const { error: updateInviteError } = await supabaseAdmin
      .from('invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', inviteId);

    if (updateInviteError) {
      console.error('Error updating invite:', updateInviteError);
    }

    // Notify admins about new user (only if it's a new user)
    if (isNewUser) {
      try {
        await supabaseAdmin.functions.invoke('notify-admins-new-user', {
          body: {
            userName: name,
            userEmail: invite.email,
            userRole: invite.role,
          },
        });
      } catch (notifyError) {
        console.error('Error notifying admins:', notifyError);
      }
    }

    console.log('Invite accepted successfully for user:', userId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Cadastro concluído com sucesso!',
        userId: userId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in accept-invite:', error);
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
