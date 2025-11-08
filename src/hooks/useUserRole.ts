import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROLE_HIERARCHY = {
  superadmin: 4,
  admin: 3,
  almoxarife: 2,
  auditor: 1,
  operador: 0,
} as const;

export type AppRole = keyof typeof ROLE_HIERARCHY;

export const useUserRole = () => {
  const queryClient = useQueryClient();

  // Fetch user's highest privilege role
  const { data: userRole, isLoading } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!rolesData || rolesData.length === 0) return null;

      // Determine highest privilege role
      const highestRole = rolesData.reduce((highest, current) => {
        const currentLevel = ROLE_HIERARCHY[current.role as AppRole] || 0;
        const highestLevel = ROLE_HIERARCHY[highest as AppRole] || 0;
        return currentLevel > highestLevel ? current.role : highest;
      }, rolesData[0].role);

      return highestRole as AppRole;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Listen for realtime changes to user_roles
  useEffect(() => {
    let channel: any;

    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel("user-roles-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_roles",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            console.log("User roles changed, refetching...");
            queryClient.invalidateQueries({ queryKey: ["user-role"] });
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  // Helper function to check if user has specific role or higher
  const hasRole = (requiredRole: AppRole): boolean => {
    if (!userRole) return false;
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  };

  // Helper function to check if user can manage (almoxarife or higher)
  const canManage = (): boolean => {
    return hasRole("almoxarife");
  };

  // Helper function to check if user is admin or higher
  const isAdmin = (): boolean => {
    return hasRole("admin");
  };

  // Helper function to check if user is superadmin
  const isSuperAdmin = (): boolean => {
    return userRole === "superadmin";
  };

  return {
    userRole,
    isLoading,
    hasRole,
    canManage,
    isAdmin,
    isSuperAdmin,
  };
};
