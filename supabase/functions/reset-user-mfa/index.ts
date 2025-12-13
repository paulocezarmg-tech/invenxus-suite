import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ResetMFASchema = z.object({
  targetUserId: z.string().uuid("ID do usuário inválido"),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client to check caller's role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the calling user
    const { data: { user: callerUser }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerUser) {
      console.error("Error getting caller user:", callerError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${callerUser.id} attempting to reset MFA for another user`);

    // Check if caller has admin or superadmin role
    const { data: hasAdminRole } = await userClient.rpc("has_role", {
      _user_id: callerUser.id,
      _role: "admin",
    });

    const { data: hasSuperadminRole } = await userClient.rpc("has_role", {
      _user_id: callerUser.id,
      _role: "superadmin",
    });

    if (!hasAdminRole && !hasSuperadminRole) {
      console.error("User does not have admin permissions");
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const parseResult = ResetMFASchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error("Invalid request body:", parseResult.error);
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { targetUserId } = parseResult.data;

    // Prevent users from resetting their own MFA via this endpoint
    if (callerUser.id === targetUserId) {
      console.error("User attempted to reset their own MFA");
      return new Response(
        JSON.stringify({ error: "Cannot reset your own MFA via admin endpoint. Use profile settings instead." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // List factors for the target user
    const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({
      userId: targetUserId,
    });

    if (factorsError) {
      console.error("Error listing MFA factors:", factorsError);
      return new Response(
        JSON.stringify({ error: "Failed to list MFA factors" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const factors = factorsData?.factors || [];
    console.log(`Found ${factors.length} MFA factors for user ${targetUserId}`);

    if (factors.length === 0) {
      return new Response(
        JSON.stringify({ message: "User has no MFA factors to reset", factorsRemoved: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete all MFA factors for the user
    let removedCount = 0;
    for (const factor of factors) {
      const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: targetUserId,
      });

      if (deleteError) {
        console.error(`Error deleting factor ${factor.id}:`, deleteError);
      } else {
        removedCount++;
        console.log(`Successfully deleted factor ${factor.id}`);
      }
    }

    console.log(`Successfully removed ${removedCount} MFA factors for user ${targetUserId}`);

    return new Response(
      JSON.stringify({ 
        message: "MFA reset successful", 
        factorsRemoved: removedCount 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
