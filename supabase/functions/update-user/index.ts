// Update user email and password securely using service role
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Input validation schema
const UpdateUserSchema = z.object({
  targetUserId: z.string().uuid({ message: "ID do usuário inválido" }),
  email: z.string().email({ message: "Email inválido" }).max(255, "Email muito longo").optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100, "Senha muito longa").optional(),
}).refine(data => data.email || data.password, {
  message: "Pelo menos email ou senha devem ser fornecidos",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticated client with the caller's JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: getUserError } = await userClient.auth.getUser();
    if (getUserError || !userRes?.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const userId = userRes.user.id;

    // Check if caller has admin or superadmin role
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isSuperadmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });

    if (!isAdmin && !isSuperadmin) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Parse and validate request body
    const body = await req.json();
    const validationResult = UpdateUserSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(", ");
      console.error('Validation error:', errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId, email, password } = validationResult.data;

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const updateData: Record<string, string> = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;

    const { data, error } = await adminClient.auth.admin.updateUserById(
      targetUserId,
      updateData
    );

    if (error) {
      console.error("Error updating user:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("User updated successfully:", targetUserId);

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error updating user:", e);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
