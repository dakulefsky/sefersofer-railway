import type { Request, Response } from "express";
import { supabase } from "./supabase";

export interface TrpcContext {
  user: {
    id: string; // UUID from Supabase Auth
    email: string;
    name?: string;
    role: "user" | "admin" | "gm" | "employee";
  } | null;
  req: Request;
  res: Response;
}

export interface ContextOpts {
  req: Request;
  res: Response;
}

/**
 * Create tRPC context by verifying the JWT token from the Authorization header.
 */
export async function createContext(opts: ContextOpts): Promise<TrpcContext> {
  const authHeader = opts.req.headers.authorization;
  const token = typeof authHeader === "string" ? authHeader.replace("Bearer ", "") : undefined;

  let user: TrpcContext["user"] = null;

  if (token) {
    try {
      // Verify the JWT with Supabase
      const {
        data: { user: supabaseUser },
        error,
      } = await supabase.auth.getUser(token);

      if (supabaseUser && !error) {
        // Load the user's profile to get their role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", supabaseUser.id)
          .single();

        user = {
          id: supabaseUser.id,
          email: supabaseUser.email || "",
          role: (profile?.role as any) || "user",
        };
      }
    } catch (err) {
      // Token verification failed, user remains null
      console.error("[Auth] Token verification failed:", err);
    }
  }

  return {
    user,
    req: opts.req,
    res: opts.res,
  };
}
