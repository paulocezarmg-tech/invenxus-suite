import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AcceptInviteRequest {
  inviteId: string;
  name: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inviteId, name, password }: AcceptInviteRequest = await req.json();

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
      throw new Error('Convite não encontrado');
    }

    if (invite.status !== 'pending') {
      throw new Error('Este convite já foi usado ou cancelado');
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new Error('Este convite expirou');
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
        throw new Error('Erro ao atualizar senha do usuário');
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
        throw new Error('Erro ao criar usuário');
      }

      if (!newUser.user) {
        throw new Error('Erro ao criar usuário');
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
        throw new Error('Erro ao vincular usuário à organização');
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
        throw new Error('Erro ao criar perfil do usuário');
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
        throw new Error('Erro ao atribuir permissões ao usuário');
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
        error: error.message || 'Erro ao processar solicitação' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
};

serve(handler);
