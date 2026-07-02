import type { Request, Response } from "express";
import { jwtVerify, importJWK } from "jose";
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

// Cache for JWKS keys
let jwksCache: Map<string, any> = new Map();
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600000; // 1 hour

/**
 * Fetch and cache the public key from Supabase JWKS endpoint
 */
async function getPublicKeyFromJWKS(keyId: string) {
  const now = Date.now();
  
  // Return cached key if still valid
  if (jwksCache.has(keyId) && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    console.log("[Auth] Using cached JWKS key:", keyId);
    return jwksCache.get(keyId);
  }

  try {
    // Fetch JWKS from Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("VITE_SUPABASE_URL not configured");
    }

    const jwksUrl = `${supabaseUrl}/.well-known/jwks.json`;
    console.log("[Auth] Fetching JWKS from:", jwksUrl);

    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new Error(`JWKS fetch failed: ${response.status} ${response.statusText}`);
    }

    const jwks = await response.json();
    console.log("[Auth] JWKS fetched successfully, keys:", jwks.keys?.length || 0);

    // Find the key with matching kid
    const key = jwks.keys?.find((k: any) => k.kid === keyId);
    if (!key) {
      throw new Error(`Key not found in JWKS: ${keyId}`);
    }

    // Cache all keys
    jwksCacheTime = now;
    jwksCache.clear();
    for (const k of jwks.keys) {
      jwksCache.set(k.kid, k);
    }

    console.log("[Auth] JWKS keys cached, returning key:", keyId);
    return key;
  } catch (err) {
    console.error("[Auth] Failed to fetch JWKS:", err instanceof Error ? err.message : err);
    throw err;
  }
}

/**
 * Create tRPC context by verifying the JWT token from the Authorization header.
 * Supabase uses ES256 (ECDSA P-256) algorithm with keys from the JWKS endpoint.
 */
export async function createContext(opts: ContextOpts): Promise<TrpcContext> {
  const authHeader = opts.req.headers.authorization;
  const token = typeof authHeader === "string" ? authHeader.replace("Bearer ", "") : undefined;

  let user: TrpcContext["user"] = null;

  if (token) {
    try {
      // Decode header to get the key ID
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("[Auth] Invalid token format");
        return { user: null, req: opts.req, res: opts.res };
      }

      const headerJson = JSON.parse(Buffer.from(parts[0], "base64").toString());
      const keyId = headerJson.kid;
      const algorithm = headerJson.alg;

      console.log("[Auth] Token algorithm:", algorithm, "Key ID:", keyId);

      if (!keyId) {
        console.error("[Auth] No key ID in token header");
        return { user: null, req: opts.req, res: opts.res };
      }

      // Fetch the public key from JWKS
      const jwk = await getPublicKeyFromJWKS(keyId);

      // Import the JWK for verification
      const publicKey = await importJWK(jwk, algorithm);

      // Verify the JWT
      const { payload } = await jwtVerify(token, publicKey);

      if (payload.sub) {
        // Load the user's profile to get their role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, email, name")
          .eq("id", payload.sub)
          .single();

        user = {
          id: payload.sub as string,
          email: (payload.email as string) || profile?.email || "",
          name: profile?.name,
          role: (profile?.role as any) || "user",
        };

        console.log("[Auth] Token verified successfully for user:", user.email);
      }
    } catch (err) {
      // Token verification failed, user remains null
      console.error("[Auth] Token verification failed:", err instanceof Error ? err.message : err);
    }
  }

  return {
    user,
    req: opts.req,
    res: opts.res,
  };
}
