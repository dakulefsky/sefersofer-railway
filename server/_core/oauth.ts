import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";

// NOTE: Deprecated for Supabase projects.
// Supabase Auth is now handled entirely on the client side.
// This file is kept for backward compatibility but all routes return errors.

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    res.status(410).json({
      error: "Manus OAuth is no longer supported. Use Supabase auth instead.",
      note: "Authentication is now handled entirely on the client side via Supabase.",
    });
  });
}
