import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Toast } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";

function RecentJobBadge({
  job,
  selected,
  onClick,
}: {
  job: { id: string; name: string; pageCount?: number; updatedAt?: string };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex flex-col items-start px-4 py-3 rounded-xl border text-left text-sm transition-all w-full",
        selected
          ? "bg-teal-50 border-teal-400 ring-1 ring-teal-300"
          : "bg-white border-stone-200 hover:border-stone-300",
      ].join(" ")}
    >
      <span className="font-semibold text-stone-800 truncate w-full">{job.name}</span>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400">
        {job.pageCount !== undefined && (
          <span>{job.pageCount} page{job.pageCount !== 1 ? "s" : ""}</span>
        )}
        {job.updatedAt && (
          <span>· {new Date(job.updatedAt).toLocaleDateString()}</span>
        )}
      </div>
    </button>
  );
}

export default function NewTranscription() {
  const [, navigate] = useLocation();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobSearch, setJobSearch] = useState("");
  const [newJobName, setNewJobName] = useState("");
  const [creatingNewJob, setCreatingNewJob] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pageLabel, setPageLabel] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, clearToast } = useToast();

  const jobs = trpc.jobs.list.useQuery();
  const createJobMutation = trpc.jobs.create.useMutation({
    onSuccess: (newJob: any) => {
      setSelectedJobId(newJob.id);
      setNewJobName("");
      setCreatingNewJob(false);
      showToast(`Job "${newJob.name}" created successfully`, "success");
      jobs.refetch();
    },
    onError: (error: any) => {
      showToast(`Failed to create job: ${error.message}`, "error");
    },
  });

  const transcribe = {
    mutate: () => {},
    isPending: false,
  };

  const allJobs = jobs.data ?? [];
  const recentJobs = [...allJobs]
    .sort((a: any, b: any) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
    .slice(0, 4);

  const filteredJobs = jobSearch.trim()
    ? allJobs.filter((j: any) =>
        j.name.toLowerCase().includes(jobSearch.toLowerCase())
      )
    : recentJobs;

  function handleFile(file: File) {
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  async function handleSubmit() {
    if (!selectedFile || !selectedJobId) return;
    // TODO: Implement transcription mutation when OCR router is ready
    showToast("Transcription feature coming soon - OCR router not yet implemented", "info");
  }

  const canSubmit =
    selectedJobId && selectedFile && !transcribe.isPending;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={clearToast}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">
            New transcription
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Upload a manuscript page to begin AI-powered transcription.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-7">

        {/* Step 1: Job selection */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-stone-700">
              <span className="text-teal-600 font-bold mr-2">1</span>
              Select a job
            </h2>
            <button
              onClick={() => {
                setCreatingNewJob(true);
                setSelectedJobId(null);
              }}
              className="text-xs text-teal-700 border border-teal-300 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition font-medium"
            >
              + New job
            </button>
          </div>

          {/* Create new job inline */}
          {creatingNewJob && (
            <div className="mb-4 flex gap-2">
              <input
                autoFocus
                type="text"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                placeholder="Job name (e.g. Vilna Gaon Siddur vol. 1)"
                className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newJobName.trim()) {
                    createJobMutation.mutate({ name: newJobName });
                  }
                  if (e.key === "Escape") setCreatingNewJob(false);
                }}
              />
              <button
                onClick={() => {
                  if (newJobName.trim()) createJobMutation.mutate({ name: newJobName });
                }}
                disabled={!newJobName.trim() || createJobMutation.isPending}
                className="px-4 py-2 bg-teal-700 text-white text-sm rounded-lg hover:bg-teal-800 transition disabled:opacity-50 font-semibold"
              >
                {createJobMutation.isPending ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => setCreatingNewJob(false)}
                className="px-3 py-2 text-stone-400 hover:text-stone-600 text-sm rounded-lg"
              >
                ✕
              </button>
            </div>
          )}

          {/* Recent jobs */}
          {jobs.isLoading ? (
            <div className="text-center py-6 text-stone-400 text-sm">Loading jobs...</div>
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-6 text-stone-400 text-sm">
              No jobs yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2 mb-4">
              {recentJobs.map((job: any) => (
                <RecentJobBadge
                  key={job.id}
                  job={job}
                  selected={selectedJobId === job.id}
                  onClick={() => setSelectedJobId(job.id)}
                />
              ))}
            </div>
          )}

          {/* Job search */}
          {allJobs.length > 4 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <input
                type="text"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search all jobs…"
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              {jobSearch.trim() && filteredJobs.length > 0 && (
                <div className="mt-3 space-y-2">
                  {filteredJobs.map((job: any) => (
                    <RecentJobBadge
                      key={job.id}
                      job={job}
                      selected={selectedJobId === job.id}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        setJobSearch("");
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Step 2: Image upload */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h2 className="font-semibold text-stone-700 mb-4">
            <span className="text-teal-600 font-bold mr-2">2</span>
            Upload manuscript page
          </h2>

          {/* Drag-drop area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={[
              "border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer",
              dragOver
                ? "border-teal-400 bg-teal-50"
                : "border-stone-300 hover:border-stone-400",
            ].join(" ")}
            onClick={() => uploadRef.current?.click()}
          >
            <div className="text-4xl mb-3">📄</div>
            <p className="font-medium text-stone-800 text-sm">
              {selectedFile ? selectedFile.name : "Drag image here or click to browse"}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Supported: PNG, JPG, WebP (max 10MB)
            </p>
            <input
              ref={uploadRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
              className="hidden"
            />
          </div>

          {/* Page label */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              Page label (optional)
            </label>
            <input
              type="text"
              value={pageLabel}
              onChange={(e) => setPageLabel(e.target.value)}
              placeholder="e.g., Page 42, Folio 3v"
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        </section>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex-1 px-4 py-3 text-stone-700 border border-stone-200 rounded-xl hover:bg-stone-50 transition font-semibold text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-3 bg-teal-700 text-white rounded-xl hover:bg-teal-800 disabled:opacity-50 transition font-semibold text-sm"
          >
            {transcribe.isPending ? "Transcribing…" : "Begin transcription"}
          </button>
        </div>
      </div>
    </div>
  );
}
