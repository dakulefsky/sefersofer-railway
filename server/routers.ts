// All user IDs are now UUIDs from Supabase Auth.
// No Manus cookies, no openId.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  listUserJobs,
  createJob,
  deleteJob,
  getPageWithRegionsAndWords,
  createPage,
  createTextRegion,
  insertWords,
  saveWordCorrection,
  markWordAsScribble,
  recordAccuracyMetrics,
  getAccuracyTrend,
  getLatestAccuracy,
  getTopLetterConfusions,
  getTopMorphologies,
  getUploadUrl,
  buildLearningPrompt,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { supabase } from "./_core/supabase";
import { transcribeAndParse } from "./transkribus";

export const appRouter = router({

  // ─── Auth ──────────────────────────────────────────────────────────────────
  // Auth is handled entirely by Supabase on the client.
  // This endpoint just returns the user from context (JWT-verified).

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user ?? null),
  }),

  // ─── Jobs ──────────────────────────────────────────────────────────────────

  jobs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return listUserJobs(ctx.user!.id);
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().min(1), description: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        return createJob(ctx.user!.id, input.name, input.description);
      }),

    delete: protectedProcedure
      .input(z.object({ jobId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await deleteJob(ctx.user!.id, input.jobId);
          return { success: true };
        } catch (e: any) {
          throw new TRPCError({
            code: e.message === "Unauthorized" ? "FORBIDDEN" : "BAD_REQUEST",
            message: e.message,
          });
        }
      }),
  }),

  // ─── Pages ─────────────────────────────────────────────────────────────────

  pages: router({
    /**
     * Get a full page: metadata + all regions + all words grouped by region.
     * This is the main query for PageReview.
     */
    getPage: protectedProcedure
      .input(z.object({ pageId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const data = await getPageWithRegionsAndWords(input.pageId);
        if (!data) throw new TRPCError({ code: "NOT_FOUND" });
        return data;
      }),

    /**
     * Get a signed upload URL so the client can push an image directly
     * to Supabase Storage. Returns the storagePath to save in the DB.
     *
     * Flow:
     *   1. Client calls getUploadUrl({ jobId, filename })
     *   2. Server returns { signedUrl, storagePath }
     *   3. Client PUTs the image to signedUrl
     *   4. Client calls createPage({ jobId, pageOrder, storagePath })
     */
    getUploadUrl: protectedProcedure
      .input(z.object({ jobId: z.string().uuid(), filename: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const ext = input.filename.split(".").pop() ?? "jpg";
        const storagePath = `${ctx.user!.id}/${input.jobId}/${Date.now()}.${ext}`;
        const data = await getUploadUrl(storagePath);
        return { ...data, storagePath };
      }),

    /**
     * Create a page record after the image has been uploaded.
     */
    create: protectedProcedure
      .input(
        z.object({
          jobId: z.string().uuid(),
          pageOrder: z.number(),
          storagePath: z.string(),
          pageLabel: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return createPage(
          input.jobId,
          input.pageOrder,
          input.storagePath,
          input.pageLabel
        );
      }),

    /**
     * Transcribe a page using the vision LLM with adaptive learning.
     * 
     * Flow:
     *   1. Fetch the image URL from Supabase Storage
     *   2. Get the adaptive learning prompt based on user's correction history
     *   3. Call the LLM with the image and learning prompt
     *   4. Parse the LLM response (JSON with regions and words)
     *   5. Save the OCR results to the database
     */
    transcribe: protectedProcedure
      .input(z.object({ pageId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        console.log("[Transcribe] Starting transcription for page:", input.pageId);
        
        try {
          // Fetch page to get storage path and job ID
          console.log("[Transcribe] Fetching page data...");
          const { data: pageData } = await supabase
          .from("pages")
          .select("id, job_id, storage_path, page_order, page_label")
          .eq("id", input.pageId)
          .single();

        if (!pageData) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Page not found" });
        }

        // Get the image URL from Supabase Storage
        const { data: signedUrlData } = await supabase.storage
          .from("manuscripts")
          .createSignedUrl(pageData.storage_path, 3600);

        if (!signedUrlData?.signedUrl) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not generate image URL",
          });
        }

        // ── LAYER 1: Transkribus HTR ──────────────────────────────────────
        // Real letter-by-letter recognition. No hallucination.
        // Uses the Hebrew model specified in TRANSKRIBUS_MODEL_ID env var.
        // Falls back to LLM-only if Transkribus is not configured yet.

        let ocrResult: { regions: any[] };

        const transkribusConfigured =
          (process.env.TRANSKRIBUS_EMAIL || process.env.TRANSKRIBUS_USER) &&
          process.env.TRANSKRIBUS_PASSWORD &&
          process.env.TRANSKRIBUS_MODEL_ID;

        if (transkribusConfigured) {
          try {
            // Transkribus needs a publicly accessible URL — use the signed URL
            const parsed = await transcribeAndParse(signedUrlData.signedUrl);
            ocrResult = parsed;
          } catch (err: any) {
            console.error("[Transkribus] HTR failed, falling back to LLM:", err.message);
            ocrResult = await runLlmFallback(
              signedUrlData.signedUrl,
              ctx.user!.id,
              pageData.job_id
            );
          }
        } else {
          // Transkribus not yet configured — use LLM until credentials are added
          ocrResult = await runLlmFallback(
            signedUrlData.signedUrl,
            ctx.user!.id,
            pageData.job_id
          );
        }

        // ── LAYER 2: AI context correction ───────────────────────────────
        // Now that Transkribus has identified the actual letters, the AI
        // reviews the word-level output for Hebrew/Aramaic context errors.
        // It does NOT look at the image — it only fixes what Transkribus produced.
        // This catches real errors like: letters that form a non-existent word,
        // common abbreviations that were misread, or garbled Aramaic terms.

        try {
          const allWords = ocrResult.regions
            .flatMap((r: any) => r.words ?? [])
            .map((w: any) => w.text)
            .join(" ");

          if (allWords.trim().length > 0) {
            const learningPrompt = await buildLearningPrompt(
              ctx.user!.id,
              pageData.job_id
            );

            const contextResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `You are a Hebrew/Aramaic Torah scholar reviewing an OCR transcription of handwritten Torah study notes.
The OCR engine has already read the letters directly from the image — do NOT change words based on what you think "should" be written.
ONLY fix a word if:
1. It contains a sequence of Hebrew letters that cannot possibly form any Hebrew or Aramaic word or abbreviation
2. You are more than 90% confident in the correction
3. The correction is a single letter change (not a whole word replacement)

Common Torah abbreviations to PRESERVE exactly as-is: ע"ש, שם, ז"ל, ע"ב, כ"כ, רמב"ם, רש"י, תוס', ר"ן, רא"ש, דהיינו

${learningPrompt}

Return ONLY a JSON object: { "corrections": [ { "original": "word", "corrected": "word", "wordIndex": 0 } ] }
If no corrections are needed, return { "corrections": [] }`,
                },
                {
                  role: "user",
                  content: `Review this OCR output for context errors:\n\n${allWords}`,
                },
              ],
              responseFormat: { type: "json_object" },
            });

            const contextText =
              typeof contextResponse.choices[0].message.content === "string"
                ? contextResponse.choices[0].message.content
                : "{}";

            const contextResult = JSON.parse(contextText);

            // Apply AI corrections to the OCR output
            if (contextResult.corrections?.length > 0) {
              for (const correction of contextResult.corrections) {
                for (const region of ocrResult.regions) {
                  for (const word of region.words ?? []) {
                    if (
                      word.wordIndex === correction.wordIndex &&
                      word.text === correction.original
                    ) {
                      // Mark as AI-corrected with slightly lower confidence
                      word.text = correction.corrected;
                      word.confidence = Math.min(word.confidence ?? 0.8, 0.85);
                      word.isFlagged = true; // flag for human review
                    }
                  }
                }
              }
            }
          }
        } catch (contextErr: any) {
          // Context correction failing is non-fatal — Transkribus output stands
          console.warn("[AI Context] Context correction failed:", contextErr.message);
        }

        // Save OCR results
        const createdRegions = [];
        for (const r of ocrResult.regions) {
          const region = await createTextRegion(input.pageId, r.regionType, {
            anchorWordIndex: r.anchorWordIndex,
          });

          if (r.words && r.words.length > 0) {
            await insertWords(
              r.words.map((w: any) => ({
                pageId: input.pageId,
                regionId: region.id,
                wordIndex: w.wordIndex,
                text: w.text,
                confidence: w.confidence ?? null,
                isFlagged: w.isFlagged ?? false,
                isScribble: w.isScribble ?? false,
                isInsertion: w.isInsertion ?? false,
              }))
            );
          }

          createdRegions.push(region);
        }

        return {
          success: true,
          regionCount: createdRegions.length,
          wordCount: ocrResult.regions.reduce(
            (sum: number, r: any) => sum + (r.words?.length ?? 0),
            0
          ),
        };
        } catch (err: any) {
          console.error("[Transcribe] Error during transcription:", err.message);
          console.error("[Transcribe] Error stack:", err.stack);
          throw err;
        }
      }),

    /**
     * Save OCR results for a page.
     * The OCR response should include regions and words with region assignments.
     * Call this after the vision model returns its transcription.
     */
    saveOcrResult: protectedProcedure
      .input(
        z.object({
          pageId: z.string().uuid(),
          regions: z.array(
            z.object({
              regionType: z.enum([
                "main",
                "margin_right",
                "margin_left",
                "margin_top",
                "margin_bottom",
                "interlinear",
              ]),
              anchorWordIndex: z.number().optional(),
              bbox: z
                .object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() })
                .optional(),
              words: z.array(
                z.object({
                  wordIndex: z.number(),
                  text: z.string(),
                  confidence: z.number().optional(),
                  isFlagged: z.boolean().optional(),
                  isScribble: z.boolean().optional(),
                  isInsertion: z.boolean().optional(),
                })
              ),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const createdRegions = [];
        for (const r of input.regions) {
          const region = await createTextRegion(input.pageId, r.regionType, {
            anchorWordIndex: r.anchorWordIndex,
            bbox: r.bbox,
          });

          if (r.words.length > 0) {
            await insertWords(
              r.words.map((w) => ({
                pageId: input.pageId,
                regionId: region.id,
                wordIndex: w.wordIndex,
                text: w.text,
                confidence: w.confidence,
                isFlagged: w.isFlagged,
                isScribble: w.isScribble,
                isInsertion: w.isInsertion,
              }))
            );
          }

          createdRegions.push(region);
        }
        return { regionCount: createdRegions.length };
      }),
  }),

  // ─── Corrections ───────────────────────────────────────────────────────────

  corrections: router({
    saveCorrection: protectedProcedure
      .input(
        z.object({
          wordId: z.string().uuid(),
          jobId: z.string().uuid(),
          originalText: z.string(),
          correctedText: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return saveWordCorrection(
          input.wordId,
          ctx.user!.id,
          input.jobId,
          input.originalText,
          input.correctedText
        );
      }),

    markScribble: protectedProcedure
      .input(
        z.object({
          wordId: z.string().uuid(),
          jobId: z.string().uuid(),
          pageId: z.string().uuid(),
          wordIndex: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return markWordAsScribble(
          input.wordId,
          ctx.user!.id,
          input.jobId,
          input.pageId
        );
      }),

    completePage: protectedProcedure
      .input(
        z.object({
          jobId: z.string().uuid(),
          pageId: z.string().uuid(),
          totalWords: z.number(),
          correctedWords: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const correctWords = input.totalWords - input.correctedWords;
        await recordAccuracyMetrics(
          ctx.user!.id,
          input.jobId,
          input.pageId,
          input.totalWords,
          correctWords
        );
        return { success: true };
      }),
  }),

  // ─── OCR Analytics ─────────────────────────────────────────────────────────

  ocr: router({
    getAccuracyTrend: protectedProcedure.query(async ({ ctx }) => {
      return getAccuracyTrend(ctx.user!.id);
    }),

    getLatestAccuracy: protectedProcedure.query(async ({ ctx }) => {
      return getLatestAccuracy(ctx.user!.id);
    }),

    getTopLetterConfusions: protectedProcedure.query(async ({ ctx }) => {
      return getTopLetterConfusions(ctx.user!.id);
    }),

    getTopMorphologies: protectedProcedure.query(async ({ ctx }) => {
      return getTopMorphologies(ctx.user!.id);
    }),

    /**
     * Get the adaptive learning prompt based on user's correction history.
     * This is used to improve the next OCR transcription.
     */
    getLearningPrompt: protectedProcedure
      .input(z.object({ jobId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const prompt = await buildLearningPrompt(ctx.user!.id, input.jobId);
        return { prompt };
      }),


  }),
});

export type AppRouter = typeof appRouter;

// ─── LLM fallback ────────────────────────────────────────────────────────────
// Used when Transkribus credentials are not yet configured.
// Once TRANSKRIBUS_EMAIL, TRANSKRIBUS_PASSWORD, TRANSKRIBUS_MODEL_ID are set
// in your .env, this function is no longer called.

async function runLlmFallback(
  imageUrl: string,
  userId: string,
  jobId: string
): Promise<{ regions: any[] }> {
  const learningPrompt = await buildLearningPrompt(userId, jobId);

  let attempt = 0;
  const maxAttempts = 2;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[LLM] Transcription attempt ${attempt}/${maxAttempts}`);

    try {
      const textPrompt = attempt === 1
        ? `Transcribe this handwritten Hebrew page. Output format: ONE WORD PER LINE. Each line: WORD|CONFIDENCE|FLAGGED
Example:
שלום|0.95|false
עברית|0.85|false
?|0.3|true

Rules:
- Read right-to-left
- Confidence: 0.3-0.95 (varied, not all same)
- Flagged: true if unclear or illegible
- Output ONLY the word list, no JSON, no explanation, no extra text`
        : `SECOND ATTEMPT - Be VERY conservative. Output format: WORD|CONFIDENCE|FLAGGED
Skip words you cannot read clearly. Vary confidence scores. Output ONLY the word list.`;

      const llmResponse = await invokeLLM({
        max_tokens: attempt === 1 ? 2000 : 1500,
        messages: [
          { role: "system", content: "You are a Hebrew manuscript OCR specialist. Output ONLY the transcribed words in the specified format. No JSON, no explanations, no extra text." },
          {
            role: "user",
            content: [
              { type: "text", text: textPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
            ],
          },
        ],
      });

      const responseText =
        typeof llmResponse.choices[0].message.content === "string"
          ? llmResponse.choices[0].message.content
          : JSON.stringify(llmResponse.choices[0].message.content);

      console.log(`[LLM] Attempt ${attempt}: Response length:`, responseText.length);

      // Parse the text-based format
      const lines = responseText.split('\n').filter(l => l.trim() && !l.startsWith('Example') && !l.includes('Rules:'));
      const words: any[] = [];
      
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const text = parts[0].trim();
          const confidence = parseFloat(parts[1].trim()) || 0.5;
          const isFlagged = parts[2].trim().toLowerCase() === 'true';
          
          if (text && !isNaN(confidence)) {
            words.push({
              wordIndex: words.length,
              text,
              confidence: Math.min(Math.max(confidence, 0.3), 0.95),
              isFlagged,
              isScribble: false,
              isInsertion: false,
            });
          }
        }
      }

      if (words.length === 0) {
        throw new Error('No words extracted from LLM response');
      }

      // Check for glitches (uniform confidence)
      const confidences = words.map(w => w.confidence);
      const uniqueConfidences = new Set(confidences);
      
      if (uniqueConfidences.size === 1) {
        console.warn(`[LLM] Glitch detected: All ${words.length} words have identical confidence (${confidences[0]})`);
        if (attempt < maxAttempts) {
          console.log(`[LLM] Retrying...`);
          lastError = `All words have identical confidence (${confidences[0]})`;
          continue;
        }
      }

      // Build the regions structure
      const parsed = {
        regions: [
          {
            regionType: "main",
            words,
          },
        ],
      };

      console.log(`[LLM] Successfully parsed OCR response with ${words.length} words`);
      return parsed;
    } catch (err: any) {
      console.error(`[LLM] Attempt ${attempt} failed:`, err.message);
      lastError = err;
      
      if (attempt < maxAttempts) {
        console.log(`[LLM] Retrying...`);
        continue;
      }
    }
  }

  // All attempts failed
  const errorMsg = `Failed to parse LLM transcription response after ${maxAttempts} attempts: ${lastError?.message || 'Unknown error'}`;
  console.error("[LLM] Throwing error:", errorMsg);
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: errorMsg,
  });
}


