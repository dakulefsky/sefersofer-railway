export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { jobs, pages, words, textRegions } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

/**
 * GET /api/export?jobId=xxx&format=txt|json
 * Exports the full transcription of a job as plain text or structured JSON.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  const format = req.nextUrl.searchParams.get("format") || "txt";

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  // Verify job ownership
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fetch all pages ordered by page number
  const jobPages = await db
    .select()
    .from(pages)
    .where(eq(pages.jobId, jobId))
    .orderBy(asc(pages.pageNumber));

  // For each page, fetch regions and words
  const pagesWithContent = await Promise.all(
    jobPages.map(async (page) => {
      const regions = await db
        .select()
        .from(textRegions)
        .where(eq(textRegions.pageId, page.id))
        .orderBy(asc(textRegions.regionOrder));

      const pageWords = await db
        .select()
        .from(words)
        .where(eq(words.pageId, page.id))
        .orderBy(asc(words.wordIndex));

      // Group words by region
      const regionsWithWords = regions.map((region) => ({
        ...region,
        words: pageWords.filter((w) => w.regionId === region.id),
      }));

      return { ...page, regions: regionsWithWords };
    })
  );

  if (format === "json") {
    // Structured JSON export
    const exportData = {
      job: { id: job.id, name: job.name, description: job.description },
      exportedAt: new Date().toISOString(),
      pages: pagesWithContent.map((page) => ({
        pageNumber: page.pageNumber,
        label: page.label,
        status: page.status,
        regions: page.regions.map((region) => ({
          type: region.regionType,
          text: region.words.map((w) => w.text).join(" "),
          words: region.words.map((w) => ({
            text: w.text,
            confidence: w.confidence,
            flagged: w.isFlagged,
          })),
        })),
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(job.name)}.json"`,
      },
    });
  }

  // Plain text export (default)
  const lines: string[] = [];
  lines.push(`# ${job.name}`);
  if (job.description) lines.push(`# ${job.description}`);
  lines.push(`# Exported: ${new Date().toLocaleDateString()}`);
  lines.push("");

  for (const page of pagesWithContent) {
    lines.push(`--- Page ${page.pageNumber}${page.label ? ` (${page.label})` : ""} ---`);
    lines.push("");

    for (const region of page.regions) {
      if (region.regionType !== "main") {
        lines.push(`[${region.regionType.replace("_", " ")}]`);
      }
      // Join words with spaces (RTL text)
      const regionText = region.words.map((w) => w.text).join(" ");
      lines.push(regionText);
      lines.push("");
    }

    if (page.regions.length === 0) {
      lines.push("(no transcription)");
      lines.push("");
    }
  }

  const textContent = lines.join("\n");

  return new NextResponse(textContent, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sanitizeFilename(job.name)}.txt"`,
    },
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\u0590-\u05FF\s\-_]/g, "").trim().replace(/\s+/g, "_") || "export";
}
