import type { Express } from "express";
import { supabase } from "./supabase";

const BUCKET_NAME = "manuscripts";

export function registerStorageProxy(app: Express) {
  // Proxy for /api/storage/* - returns signed URLs from Supabase Storage
  app.get("/api/storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      // Get signed URL from Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(key, 3600); // 1 hour expiry

      if (error) {
        console.error(`[StorageProxy] Supabase error: ${error.message}`);
        res.status(502).send("Storage backend error");
        return;
      }

      if (!data?.signedUrl) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, data.signedUrl);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });

  // Legacy Manus storage proxy (for backwards compatibility)
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      // Get signed URL from Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(key, 3600); // 1 hour expiry

      if (error) {
        console.error(`[StorageProxy] Supabase error: ${error.message}`);
        res.status(502).send("Storage backend error");
        return;
      }

      if (!data?.signedUrl) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, data.signedUrl);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
