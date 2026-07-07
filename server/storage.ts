// Storage helpers using Supabase Storage (portable for Railway)
// Uploads to Supabase Storage bucket and returns signed URLs

import { supabase } from "./_core/supabase";

const BUCKET_NAME = "manuscripts";

async function ensureBucketExists() {
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
    if (error && error.message.includes("not found")) {
      // Bucket doesn't exist, try to create it
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
    }
  } catch (err) {
    console.warn(`Could not ensure bucket exists: ${err}`);
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  await ensureBucketExists();
  
  const key = appendHashSuffix(normalizeKey(relKey));
  
  // Convert data to Buffer
  const buffer = typeof data === "string" 
    ? Buffer.from(data) 
    : Buffer.from(data as any);

  // Upload to Supabase Storage
  const { data: uploadData, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(key, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  if (!uploadData) {
    throw new Error("Storage upload returned no data");
  }

  // Return the storage path (will be accessed via signed URLs)
  return { 
    key, 
    url: `/api/storage/${key}` // Use our own proxy endpoint
  };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { 
    key, 
    url: `/api/storage/${key}` // Use our own proxy endpoint
  };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(key, 3600); // 1 hour expiry

  if (error) {
    throw new Error(`Storage signed URL failed: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error("Storage signed URL returned no URL");
  }

  return data.signedUrl;
}
