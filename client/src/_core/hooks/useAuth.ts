import { useAuth as useSupabaseAuth } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useCallback } from "react";

/**
 * useAuth hook for Supabase-based authentication.
 * Returns user info, loading state, and logout function.
 */
export function useAuth() {
  const { user, loading, signOut } = useSupabaseAuth();

  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("[Auth] Logout failed:", error);
      throw error;
    }
  }, [signOut]);

  return {
    user: user
      ? {
          id: user.id,
          email: user.email || "",
          name: user.user_metadata?.name,
        }
      : null,
    loading,
    isAuthenticated: Boolean(user),
    logout,
    error: null,
  };
}
