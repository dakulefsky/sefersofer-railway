// All database access goes through this file.
// Uses the Supabase service-role client (bypasses RLS — safe server-only).

import { supabase } from "./_core/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RegionType =
  | "main"
  | "margin_right"
  | "margin_left"
  | "margin_top"
  | "margin_bottom"
  | "interlinear";

export interface WordRow {
  id: string;
  page_id: string;
  region_id: string | null;
  word_index: number;
  text: string;
  confidence: number | null;
  is_flagged: boolean;
  is_scribble: boolean;
  is_insertion: boolean;
  created_at: string;
  updated_at: string;
}

export interface TextRegionRow {
  id: string;
  page_id: string;
  region_type: RegionType;
  anchor_word_index: number | null;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_w: number | null;
  bbox_h: number | null;
}

// ─── Image Storage ───────────────────────────────────────────────────────────

const BUCKET = "manuscripts";

/**
 * Generate a signed upload URL so the client can push an image directly
 * to Supabase Storage without routing through the server.
 *
 * storagePath example: "{userId}/{jobId}/{pageId}.jpg"
 */
export async function getUploadUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (error) throw new Error(`Storage upload URL failed: ${error.message}`);
  return data; // { signedUrl, token, path }
}

/**
 * Get a long-lived public URL for a stored image.
 * Pages store only the storagePath; derive the URL on demand.
 */
export function getImageUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateLastSignedIn(userId: string) {
  await supabase
    .from("profiles")
    .update({ last_signed_in: new Date().toISOString() })
    .eq("id", userId);
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function listUserJobs(userId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createJob(
  userId: string,
  name: string,
  description?: string
) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({ user_id: userId, name, description })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteJob(userId: string, jobId: string) {
  // Verify ownership first
  const { data: job } = await supabase
    .from("jobs")
    .select("user_id")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("Job not found");
  if (job.user_id !== userId) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("jobs")
    .update({ archived: true })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function createPage(
  jobId: string,
  pageOrder: number,
  storagePath: string,
  pageLabel?: string
) {
  const { data, error } = await supabase
    .from("pages")
    .insert({ job_id: jobId, page_order: pageOrder, storage_path: storagePath, page_label: pageLabel })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getPageWithRegionsAndWords(pageId: string) {
  const [pageRes, regionsRes, wordsRes] = await Promise.all([
    supabase.from("pages").select("*").eq("id", pageId).single(),
    supabase
      .from("text_regions")
      .select("*")
      .eq("page_id", pageId)
      .order("region_type"),
    supabase
      .from("words")
      .select("*")
      .eq("page_id", pageId)
      .order("word_index"),
  ]);

  if (pageRes.error) throw new Error(pageRes.error.message);

  const page = pageRes.data;
  const regions = regionsRes.data ?? [];
  const words = wordsRes.data ?? [];

  // Attach image URL
  const imageUrl = page.storage_path ? getImageUrl(page.storage_path) : null;

  // Group words by region
  const wordsByRegion: Record<string, WordRow[]> = {};
  for (const word of words) {
    const key = word.region_id ?? "unassigned";
    if (!wordsByRegion[key]) wordsByRegion[key] = [];
    wordsByRegion[key].push(word as WordRow);
  }

  return { page: { ...page, imageUrl }, regions, wordsByRegion, words };
}

// ─── Text Regions ────────────────────────────────────────────────────────────

export async function createTextRegion(
  pageId: string,
  regionType: RegionType,
  opts?: {
    anchorWordIndex?: number;
    bbox?: { x: number; y: number; w: number; h: number };
  }
) {
  const { data, error } = await supabase
    .from("text_regions")
    .insert({
      page_id: pageId,
      region_type: regionType,
      anchor_word_index: opts?.anchorWordIndex ?? null,
      bbox_x: opts?.bbox?.x ?? null,
      bbox_y: opts?.bbox?.y ?? null,
      bbox_w: opts?.bbox?.w ?? null,
      bbox_h: opts?.bbox?.h ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ─── Words ───────────────────────────────────────────────────────────────────

export async function insertWords(
  words: {
    pageId: string;
    regionId?: string;
    wordIndex: number;
    text: string;
    confidence?: number;
    isFlagged?: boolean;
    isScribble?: boolean;
    isInsertion?: boolean;
  }[]
) {
  const rows = words.map((w) => ({
    page_id: w.pageId,
    region_id: w.regionId ?? null,
    word_index: w.wordIndex,
    text: w.text,
    confidence: w.confidence ?? null,
    is_flagged: w.isFlagged ?? false,
    is_scribble: w.isScribble ?? false,
    is_insertion: w.isInsertion ?? false,
  }));

  const { data, error } = await supabase.from("words").insert(rows).select();
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── Word Corrections ────────────────────────────────────────────────────────

export async function saveWordCorrection(
  wordId: string,
  userId: string,
  jobId: string,
  originalText: string,
  correctedText: string
) {
  const { data, error } = await supabase
    .from("word_corrections")
    .insert({
      word_id: wordId,
      user_id: userId,
      original_text: originalText,
      corrected_text: correctedText,
      is_user_marked_scribble: false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Feed the learning system
  if (originalText.length === 1 && correctedText.length === 1) {
    await recordLetterConfusion(userId, jobId, originalText, correctedText);
  } else if (originalText.length === correctedText.length) {
    for (let i = 0; i < originalText.length; i++) {
      if (originalText[i] !== correctedText[i]) {
        await recordLetterConfusion(userId, jobId, originalText[i], correctedText[i]);
      }
    }
  }

  return data;
}

export async function markWordAsScribble(
  wordId: string,
  userId: string,
  jobId: string,
  pageId: string
) {
  // Get word text
  const { data: word } = await supabase
    .from("words")
    .select("text")
    .eq("id", wordId)
    .single();

  await Promise.all([
    // Mark the word itself
    supabase.from("words").update({ is_scribble: true }).eq("id", wordId),
    // Record in corrections table
    supabase.from("word_corrections").insert({
      word_id: wordId,
      user_id: userId,
      original_text: word?.text ?? "",
      corrected_text: "",
      is_user_marked_scribble: true,
    }),
  ]);

  return { success: true };
}

// ─── OCR Learning: Letter Confusion ──────────────────────────────────────────

export async function recordLetterConfusion(
  userId: string,
  jobId: string,
  originalLetter: string,
  correctedLetter: string
) {
  // Postgres upsert with ON CONFLICT — clean and atomic
  const { error } = await supabase.rpc("upsert_letter_confusion", {
    p_user_id: userId,
    p_job_id: jobId,
    p_original: originalLetter,
    p_corrected: correctedLetter,
  });

  if (error) {
    // Fallback if RPC not yet created: manual upsert
    const { data: existing } = await supabase
      .from("letter_confusion_pairs")
      .select("id, count")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .eq("original_letter", originalLetter)
      .eq("corrected_letter", correctedLetter)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("letter_confusion_pairs")
        .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("letter_confusion_pairs").insert({
        user_id: userId,
        job_id: jobId,
        original_letter: originalLetter,
        corrected_letter: correctedLetter,
        count: 1,
      });
    }
  }
}

export async function getTopLetterConfusions(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from("letter_confusion_pairs")
    .select("*")
    .eq("user_id", userId)
    .order("count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── OCR Learning: Morphology ─────────────────────────────────────────────────

export async function recordLetterMorphologyVariant(
  userId: string,
  jobId: string,
  letter: string,
  morphology: string,
  context?: string
) {
  const { data: existing } = await supabase
    .from("letter_morphology_variants")
    .select("id, count")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("letter", letter)
    .eq("morphology", morphology)
    .eq("context", context ?? null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("letter_morphology_variants")
      .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("letter_morphology_variants").insert({
      user_id: userId,
      job_id: jobId,
      letter,
      morphology,
      context: context ?? null,
      count: 1,
    });
  }
}

export async function getTopMorphologies(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from("letter_morphology_variants")
    .select("*")
    .eq("user_id", userId)
    .order("count", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── OCR Accuracy ────────────────────────────────────────────────────────────

export async function recordAccuracyMetrics(
  userId: string,
  jobId: string,
  pageId: string,
  totalWords: number,
  correctWords: number
) {
  const accuracy = totalWords === 0 ? 0 : Math.round((correctWords / totalWords) * 100);
  await supabase.from("ocr_accuracy_metrics").insert({
    user_id: userId,
    job_id: jobId,
    page_id: pageId,
    total_words: totalWords,
    correct_words: correctWords,
    accuracy,
  });
}

export async function getAccuracyTrend(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("ocr_accuracy_metrics")
    .select("accuracy, page_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({ accuracy: m.accuracy / 100, pageId: m.page_id }));
}

export async function getLatestAccuracy(userId: string) {
  const { data, error } = await supabase
    .from("ocr_accuracy_metrics")
    .select("accuracy")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { accuracy: data.accuracy / 100 } : null;
}

// ─── Learning Prompt Builder ──────────────────────────────────────────────────

export async function buildLearningPrompt(userId: string, jobId: string): Promise<string> {
  const [confusions, morphologies] = await Promise.all([
    getTopLetterConfusions(userId, 15),
    getTopMorphologies(userId, 15),
  ]);

  let prompt =
    "You are transcribing a Hebrew manuscript. Based on corrections made to earlier pages:\n\n";

  if (confusions.length > 0) {
    prompt += "Letter confusions seen in this hand:\n";
    for (const c of confusions) {
      prompt += `- What looks like ${c.original_letter} is often actually ${c.corrected_letter} (seen ${c.count}×)\n`;
    }
    prompt += "\n";
  }

  if (morphologies.length > 0) {
    prompt += "Visual patterns in this manuscript:\n";
    for (const m of morphologies) {
      const ctx = m.context ? ` in ${m.context} position` : "";
      prompt += `- The letter ${m.letter} often appears ${m.morphology}${ctx} (${m.count}×)\n`;
    }
    prompt += "\n";
  }

  prompt += `Annotation types to recognize:
- MAIN TEXT: the primary text block, read right-to-left
- MARGIN NOTES: text written in margins (mark region: margin_right, margin_left, margin_top, margin_bottom)
- INTERLINEAR: words written between lines of main text, often with a caret (^) pointing to the insertion point
- SCRIBBLE: random strokes, cross-outs, ink blots that are not intentional letters — transcribe as "[scribble]"

Return a JSON structure with regions, each containing their word list and region_type.
Only suggest corrections when confidence exceeds 85%.`;

  return prompt;
}
