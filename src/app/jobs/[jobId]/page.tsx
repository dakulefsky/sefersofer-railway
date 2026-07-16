"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Upload,
  Trash2,
} from "lucide-react";

interface Page {
  id: string;
  pageNumber: number;
  label?: string;
  status: string;
  wordCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface Job {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pages: Page[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "bg-stone-100 text-stone-500",
    icon: <Clock className="w-3 h-3" />,
  },
  processing: {
    label: "Processing",
    color: "bg-yellow-100 text-yellow-700",
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  transcribed: {
    label: "Transcribed",
    color: "bg-blue-100 text-blue-700",
    icon: <FileText className="w-3 h-3" />,
  },
  reviewed: {
    label: "Reviewed",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  failed: {
    label: "Failed",
    color: "bg-red-100 text-red-700",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
};

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (res.ok) setJob(await res.json());
      else if (res.status === 404) router.replace("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [jobId, router]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  async function handleDelete() {
    if (!confirm(`Delete "${job?.name}" and all its pages? This cannot be undone.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else setDeleting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
      </div>
    );
  }

  if (!job) return null;

  const reviewedCount = job.pages.filter((p) => p.status === "reviewed").length;
  const transcribedCount = job.pages.filter((p) => p.status === "transcribed").length;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-stone-400 hover:text-stone-700 transition-colors flex items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:block">Dashboard</span>
            </Link>
            <span className="text-stone-300">/</span>
            <h1 className="font-semibold text-stone-800 truncate max-w-[200px] sm:max-w-none">
              {job.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/batch?jobId=${jobId}`}
              className="flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Batch Upload
            </Link>
            <Link
              href={`/transcribe?jobId=${jobId}`}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Page
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Job summary */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6 flex flex-wrap gap-6 items-center justify-between">
          <div>
            {job.description && (
              <p className="text-stone-500 text-sm mb-2">{job.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-stone-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {job.pages.length} page{job.pages.length !== 1 ? "s" : ""}
              </span>
              {transcribedCount > 0 && (
                <span className="flex items-center gap-1.5 text-blue-600">
                  <FileText className="w-4 h-4" />
                  {transcribedCount} transcribed
                </span>
              )}
              {reviewedCount > 0 && (
                <span className="flex items-center gap-1.5 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  {reviewedCount} reviewed
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                Updated {new Date(job.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Delete Job
          </button>
        </div>

        {/* Pages grid */}
        {job.pages.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-stone-500 font-medium mb-2">No pages yet</h3>
            <p className="text-stone-400 text-sm mb-6">
              Upload your first manuscript page to start transcribing.
            </p>
            <Link
              href={`/transcribe?jobId=${jobId}`}
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload First Page
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {job.pages.map((page) => {
              const statusCfg = STATUS_CONFIG[page.status] ?? STATUS_CONFIG.pending;
              return (
                <Link
                  key={page.id}
                  href={
                    page.status === "pending" || page.status === "failed"
                      ? `/transcribe?jobId=${jobId}`
                      : `/review/${jobId}/${page.id}`
                  }
                  className="bg-white rounded-xl border border-stone-200 hover:border-teal-300 hover:shadow-md p-4 transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center text-stone-500 text-xs font-bold group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                      {page.pageNumber}
                    </div>
                    <span
                      className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.color}`}
                    >
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="font-medium text-stone-800 text-sm truncate mb-1">
                    {page.label || `Page ${page.pageNumber}`}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    {page.wordCount != null && (
                      <span>{page.wordCount} words</span>
                    )}
                    <span>{new Date(page.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
