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
        // Fetch page to get storage path and job ID
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

        // Get adaptive learning prompt
        const learningPrompt = await buildLearningPrompt(
          ctx.user!.id,
          pageData.job_id
        );

        // Call LLM with vision
        const llmResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: learningPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: 'Transcribe this Hebrew manuscript page. Return a JSON object with a "regions" array, where each region has "regionType" (main, margin_right, margin_left, margin_top, margin_bottom, interlinear), "anchorWordIndex" (for interlinear only), and "words" array with {wordIndex, text, confidence, isFlagged, isScribble, isInsertion}.',
                },
                {
                  type: "image_url",
                  image_url: {
                    url: signedUrlData.signedUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          responseFormat: {
            type: "json_schema",
            json_schema: {
              name: "ocr_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  regions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        regionType: {
                          type: "string",
                          enum: [
                            "main",
                            "margin_right",
                            "margin_left",
                            "margin_top",
                            "margin_bottom",
                            "interlinear",
                          ],
                        },
                        anchorWordIndex: { type: "number" },
                        words: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              wordIndex: { type: "number" },
                              text: { type: "string" },
                              confidence: { type: "number" },
                              isFlagged: { type: "boolean" },
                              isScribble: { type: "boolean" },
                              isInsertion: { type: "boolean" },
                            },
                            required: ["wordIndex", "text"],
                          },
                        },
                      },
                      required: ["regionType", "words"],
                    },
                  },
                },
                required: ["regions"],
              },
            },
          },
        });

        // Parse LLM response
        const responseText =
          typeof llmResponse.choices[0].message.content === "string"
            ? llmResponse.choices[0].message.content
            : JSON.stringify(llmResponse.choices[0].message.content);

        let ocrResult;
        try {
          ocrResult = JSON.parse(responseText);
        } catch (e) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to parse LLM response",
          });
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
