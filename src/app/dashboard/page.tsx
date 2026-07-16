"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, BookOpen, FileText, Clock, ChevronRight } from "lucide-react";

interface Job {
  id: string;
  name: string;
  description?: string;
  status: string;
  pageCount: number;
  updatedAt: string;
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newJobName, setNewJobName] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) setJobs(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!newJobName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newJobName.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setNewJobName("");
        setShowForm(false);
        // Navigate directly to the new job
        window.location.href = `/jobs/${created.id}`;
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">My Transcription Jobs</h1>
          <p className="text-stone-500 text-sm mt-1">
            Each job is a manuscript collection — a notebook, letter set, or archive.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      </div>

      {/* New job form */}
      {showForm && (
        <form
          onSubmit={createJob}
          className="bg-white border border-teal-200 rounded-xl p-4 mb-6 flex gap-3"
        >
          <input
            autoFocus
            type="text"
            value={newJobName}
            onChange={(e) => setNewJobName(e.target.value)}
            placeholder="Job name (e.g. Grandfather's Letters 1943)"
            className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            type="submit"
            disabled={creating || !newJobName.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {creating ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="text-stone-400 hover:text-stone-600 text-sm px-3"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Jobs list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 p-5 animate-pulse">
              <div className="h-4 bg-stone-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-stone-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-stone-500 font-medium mb-2">No jobs yet</h3>
          <p className="text-stone-400 text-sm">
            Create your first job to start transcribing manuscripts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="bg-white rounded-xl border border-stone-200 hover:border-teal-300 hover:shadow-md p-5 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <BookOpen className="w-4 h-4 text-teal-600" />
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    job.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : job.status === "processing"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {job.status}
                </span>
              </div>
              <h3 className="font-semibold text-stone-800 mb-1 truncate">{job.name}</h3>
              {job.description && (
                <p className="text-xs text-stone-400 mb-3 line-clamp-2">{job.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {job.pageCount} page{job.pageCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(job.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-teal-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
