import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { pages, textRegions, words } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ─── Input validation ─────────────────────────────────────────────────────────

const RequestSchema = z.object({
  pageId: z.string().uuid("pageId must be a valid UUID"),
  imageBase64: z.string().min(100, "imageBase64 is required"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).default("image/jpeg"),
});

// ─── OpenAI response shape ────────────────────────────────────────────────────

const WordSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1),
  flagged: z.boolean().optional().default(false),
});

const RegionSchema = z.object({
  region_type: z.enum(["main", "margin_right", "margin_left", "interlinear"]).default("main"),
  words: z.array(WordSchema),
});

const TranscriptionResponseSchema = z.object({
  regions: z.array(RegionSchema),
});

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in Hebrew paleography and handwritten text recognition (HTR).
Your task is to transcribe handwritten Hebrew text from manuscript images.

CRITICAL RULES:
1. Output ONLY valid JSON — no markdown, no code blocks, no explanations.
2. Read Hebrew text RIGHT-TO-LEFT. Preserve the original word order.
3. Identify distinct text regions: main body, right margin, left margin, interlinear insertions.
4. For each word, provide:
   - "text": the Hebrew word exactly as written (Unicode Hebrew characters)
   - "confidence": a float from 0.0 to 1.0 (0.3 = very uncertain, 0.95 = very certain)
   - "flagged": true if the word is ambiguous, damaged, or unclear
5. Handle common Hebrew cursive variants: swirly פ, looped ל, connected ת.
6. If a word is illegible, use "?" as the text with confidence 0.1 and flagged: true.
7. Do NOT hallucinate words. If you cannot read it, flag it.

Output schema:
{
  "regions": [
    {
      "region_type": "main" | "margin_right" | "margin_left" | "interlinear",
      "words": [
        { "text": "שלום", "confidence": 0.95, "flagged": false }
      ]
    }
  ]
}`;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Validate OpenAI key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Add it to your Railway environment variables." },
      { status: 500 }
    );
  }

  // 3. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { pageId, imageBase64, mimeType } = parsed.data;

  // 4. Verify page belongs to this user
  const [page] = await db
    .select()
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  // Verify ownership via job
  const { data: job } = await supabase
    .from("jobs")
    .select("user_id")
    .eq("id", page.jobId)
    .single();

  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Mark page as processing
  await db
    .update(pages)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(pages.id, pageId));

  // 6. Call OpenAI GPT-4o Vision
  const openai = new OpenAI({ apiKey: openaiKey });

  let transcriptionResult: z.infer<typeof TranscriptionResponseSchema>;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Transcribe all Hebrew handwritten text in this image. Return only the JSON object.",
            },
          ],
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("OpenAI returned an empty response.");
    }

    const rawJson = JSON.parse(rawContent);
    const validated = TranscriptionResponseSchema.safeParse(rawJson);

    if (!validated.success) {
      console.error("[transcribe] OpenAI response failed schema validation:", validated.error);
      throw new Error("OpenAI response did not match expected schema.");
    }

    transcriptionResult = validated.data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown OpenAI error";
    console.error("[transcribe] OpenAI error:", message);

    await db
      .update(pages)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(pages.id, pageId));

    return NextResponse.json({ error: `Transcription failed: ${message}` }, { status: 502 });
  }

  // 7. Save results to database
  try {
    let totalWords = 0;

    for (let regionOrder = 0; regionOrder < transcriptionResult.regions.length; regionOrder++) {
      const region = transcriptionResult.regions[regionOrder];

      // Insert region
      const [insertedRegion] = await db
        .insert(textRegions)
        .values({
          pageId,
          regionType: region.region_type,
          regionOrder,
        })
        .returning();

      // Insert words for this region
      if (region.words.length > 0) {
        await db.insert(words).values(
          region.words.map((word, wordIndex) => ({
            pageId,
            regionId: insertedRegion.id,
            wordIndex: totalWords + wordIndex,
            text: word.text,
            confidence: word.confidence,
            isFlagged: word.flagged || word.confidence < 0.5,
            isScribble: false,
            isInsertion: region.region_type === "interlinear",
          }))
        );
        totalWords += region.words.length;
      }
    }

    // Mark page as transcribed
    await db
      .update(pages)
      .set({ status: "transcribed", wordCount: totalWords, updatedAt: new Date() })
      .where(eq(pages.id, pageId));

    return NextResponse.json({
      success: true,
      pageId,
      wordCount: totalWords,
      regionCount: transcriptionResult.regions.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("[transcribe] DB save error:", message);
    return NextResponse.json({ error: `Failed to save results: ${message}` }, { status: 500 });
  }
}
