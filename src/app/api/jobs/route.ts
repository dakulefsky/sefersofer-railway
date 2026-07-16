export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { jobs, pages } from "@/lib/db/schema";
import { eq, desc, count } from "drizzle-orm";

// GET /api/jobs — list all jobs for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userJobs = await db
    .select({
      id: jobs.id,
      name: jobs.name,
      description: jobs.description,
      status: jobs.status,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(eq(jobs.userId, user.id))
    .orderBy(desc(jobs.updatedAt));

  // Attach page counts
  const jobsWithCounts = await Promise.all(
    userJobs.map(async (job) => {
      const [{ value: pageCount }] = await db
        .select({ value: count() })
        .from(pages)
        .where(eq(pages.jobId, job.id));
      return { ...job, pageCount: Number(pageCount) };
    })
  );

  return NextResponse.json(jobsWithCounts);
}

// POST /api/jobs — create a new job
const CreateJobSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const [newJob] = await db
    .insert(jobs)
    .values({
      userId: user.id,
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning();

  return NextResponse.json(newJob, { status: 201 });
}
