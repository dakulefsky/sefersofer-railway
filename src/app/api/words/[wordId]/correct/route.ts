import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { words, wordCorrections, pages, jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CorrectionSchema = z.object({
  correctedText: z.string().min(1),
});

// Next.js 15: params is a Promise
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ wordId: string }> }
) {
  const { wordId } = await params;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CorrectionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Get the word and verify ownership
  const [word] = await db
    .select({
      id: words.id,
      text: words.text,
      pageId: words.pageId,
    })
    .from(words)
    .where(eq(words.id, wordId))
    .limit(1);

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  // Verify ownership via page → job
  const [page] = await db
    .select({ jobId: pages.jobId })
    .from(pages)
    .where(eq(pages.id, word.pageId))
    .limit(1);

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const [job] = await db
    .select({ userId: jobs.userId })
    .from(jobs)
    .where(eq(jobs.id, page.jobId))
    .limit(1);

  if (!job || job.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Save correction
  const [correction] = await db
    .insert(wordCorrections)
    .values({
      wordId: word.id,
      userId: user.id,
      originalText: word.text,
      correctedText: parsed.data.correctedText,
    })
    .returning();

  // Update the word text
  await db
    .update(words)
    .set({
      text: parsed.data.correctedText,
      isFlagged: false,
      updatedAt: new Date(),
    })
    .where(eq(words.id, wordId));

  return NextResponse.json({ success: true, correction });
}
