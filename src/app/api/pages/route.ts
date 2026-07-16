export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { pages, jobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const BUCKET = "manuscripts";

// POST /api/pages — create a page and get a signed upload URL
const CreatePageSchema = z.object({
  jobId: z.string().uuid(),
  label: z.string().optional(),
  pageNumber: z.number().int().positive().default(1),
  fileName: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreatePageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, label, pageNumber, fileName, contentType } = parsed.data;

  // Verify job ownership
  const [job] = await db.select().from(jobs).where(
    and(eq(jobs.id, jobId), eq(jobs.userId, user.id))
  ).limit(1);

  if (!job) {
    return NextResponse.json({ error: "Job not found or access denied" }, { status: 404 });
  }

  // Create the page record first to get the ID
  const [newPage] = await db
    .insert(pages)
    .values({
      jobId,
      pageNumber,
      label,
      status: "pending",
    })
    .returning();

  // Generate storage path
  const ext = fileName.split(".").pop() || "jpg";
  const storagePath = `${user.id}/${jobId}/${newPage.id}.${ext}`;

  // Get a signed upload URL from Supabase Storage
  const serviceClient = createServiceClient();
  const { data: uploadData, error: uploadError } = await serviceClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);

  if (uploadError || !uploadData) {
    // Clean up the page record
    await db.delete(pages).where(eq(pages.id, newPage.id));
    return NextResponse.json(
      { error: `Failed to create upload URL: ${uploadError?.message}` },
      { status: 500 }
    );
  }

  // Update page with storage path
  await db
    .update(pages)
    .set({ storagePath, updatedAt: new Date() })
    .where(eq(pages.id, newPage.id));

  return NextResponse.json({
    page: { ...newPage, storagePath },
    uploadUrl: uploadData.signedUrl,
    token: uploadData.token,
    storagePath,
  }, { status: 201 });
}

// GET /api/pages?pageId=xxx — get a page with all its words
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch page with regions and words (separate queries to avoid parser issues)
  const { data: pageData, error: pageError } = await serviceClient
    .from("pages")
    .select("*, jobs!inner(user_id)")
    .eq("id", pageId)
    .eq("jobs.user_id", user.id)
    .single();

  if (pageError || !pageData) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Fetch regions
  const { data: regions } = await serviceClient
    .from("text_regions")
    .select("*")
    .eq("page_id", pageId)
    .order("region_order");

  // Fetch words
  const { data: allWords } = await serviceClient
    .from("words")
    .select("*")
    .eq("page_id", pageId)
    .order("word_index");

  // Group words by region
  const regionsWithWords = (regions || []).map((region: Record<string, unknown>) => ({
    ...region,
    words: (allWords || []).filter((w: Record<string, unknown>) => w.region_id === region.id),
  }));

  // Generate a signed image URL
  let imageUrl: string | null = null;
  if (pageData.storage_path) {
    const { data: signedData } = await serviceClient.storage
      .from(BUCKET)
      .createSignedUrl(pageData.storage_path, 3600);
    imageUrl = signedData?.signedUrl || null;
  }

  return NextResponse.json({
    ...pageData,
    imageUrl,
    text_regions: regionsWithWords,
  });
}
