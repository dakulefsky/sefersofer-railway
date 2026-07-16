"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  ImageIcon,
  Play,
} from "lucide-react";

type FileStatus = "queued" | "uploading" | "transcribing" | "done" | "error";

interface QueuedFile {
  id: string;
  file: File;
  preview: string;
  label: string;
  status: FileStatus;
  error?: string;
  pageId?: string;
}

export default function BatchUploadPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
        </div>
      }
    >
      <BatchUploadPage />
    </Suspense>
  );
}

function BatchUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!jobId) router.replace("/dashboard");
  }, [jobId, router]);

  function addFiles(files: FileList | File[]) {
    const valid: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) continue;
      const preview = URL.createObjectURL(file);
      valid.push({
        id: crypto.randomUUID(),
        file,
        preview,
        label: file.name.replace(/\.[^.]+$/, ""),
        status: "queued",
      });
    }
    setQueue((prev) => [...prev, ...valid]);
  }

  function removeFile(id: string) {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFile(id: string, patch: Partial<QueuedFile>) {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function processFile(item: QueuedFile): Promise<void> {
    if (abortRef.current) return;

    updateFile(item.id, { status: "uploading", error: undefined });

    try {
      // Step 1: Create page record + get signed upload URL
      const createRes = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          label: item.label || item.file.name,
          fileName: item.file.name,
          contentType: item.file.type,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create page");
      }

      const { page, uploadUrl } = await createRes.json();

      // Step 2: Upload to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": item.file.type },
        body: item.file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload image");

      if (abortRef.current) return;

      // Step 3: Transcribe with GPT-4o
      updateFile(item.id, { status: "transcribing" });

      const base64 = await fileToBase64(item.file);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          imageBase64: base64,
          mimeType: item.file.type,
        }),
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error || "Transcription failed");
      }

      updateFile(item.id, { status: "done", pageId: page.id });
    } catch (err: unknown) {
      updateFile(item.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function startBatch() {
    abortRef.current = false;
    setRunning(true);

    const toProcess = queue.filter((f) => f.status === "queued" || f.status === "error");

    for (const item of toProcess) {
      if (abortRef.current) break;
      await processFile(item);
    }

    setRunning(false);
  }

  function stopBatch() {
    abortRef.current = true;
    setRunning(false);
  }

  const doneCount = queue.filter((f) => f.status === "done").length;
  const errorCount = queue.filter((f) => f.status === "error").length;
  const pendingCount = queue.filter((f) => f.status === "queued").length;
  const activeItem = queue.find((f) => f.status === "uploading" || f.status === "transcribing");

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Back bar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href={jobId ? `/jobs/${jobId}` : "/dashboard"}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to job
          </Link>
          <h1 className="font-semibold text-stone-800">Batch Upload</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Drop zone */}
        <div
          onClick={() => !running && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`border-2 border-dashed rounded-2xl p-10 text-center mb-6 transition-colors ${
            running ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
          } ${
            dragOver ? "border-teal-400 bg-teal-50" : "border-stone-200 hover:border-stone-300"
          }`}
        >
          <ImageIcon className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-stone-600">
            Drop multiple images here or click to browse
          </p>
          <p className="text-xs text-stone-400 mt-1">JPEG, PNG, WebP — max 20 MB each</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* Summary bar */}
        {queue.length > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl px-5 py-3 mb-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-stone-600 font-medium">{queue.length} files</span>
              {doneCount > 0 && (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {doneCount} done
                </span>
              )}
              {errorCount > 0 && (
                <span className="text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errorCount} failed
                </span>
              )}
              {activeItem && (
                <span className="text-teal-600 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {activeItem.status === "uploading" ? "Uploading…" : "Transcribing…"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {running ? (
                <button
                  onClick={stopBatch}
                  className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={startBatch}
                  disabled={pendingCount === 0 && errorCount === 0}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  {errorCount > 0 ? "Retry Failed" : "Start Transcription"}
                </button>
              )}
              {doneCount === queue.length && doneCount > 0 && (
                <Link
                  href={`/jobs/${jobId}`}
                  className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  View Job
                </Link>
              )}
            </div>
          </div>
        )}

        {/* File grid */}
        {queue.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl border overflow-hidden transition-all ${
                  item.status === "done"
                    ? "border-green-200"
                    : item.status === "error"
                    ? "border-red-200"
                    : item.status === "uploading" || item.status === "transcribing"
                    ? "border-teal-300 shadow-md"
                    : "border-stone-200"
                }`}
              >
                {/* Image preview */}
                <div className="relative aspect-[3/4] bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.preview}
                    alt={item.label}
                    className="w-full h-full object-cover"
                  />
                  {/* Status overlay */}
                  {(item.status === "uploading" || item.status === "transcribing") && (
                    <div className="absolute inset-0 bg-teal-900/40 flex flex-col items-center justify-center">
                      <Loader2 className="w-6 h-6 text-white animate-spin mb-1" />
                      <span className="text-white text-xs font-medium">
                        {item.status === "uploading" ? "Uploading" : "Transcribing"}
                      </span>
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute inset-0 bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-white" />
                    </div>
                  )}
                  {/* Remove button */}
                  {!running && item.status !== "done" && (
                    <button
                      onClick={() => removeFile(item.id)}
                      className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>

                {/* Label input */}
                <div className="p-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateFile(item.id, { label: e.target.value })}
                    disabled={running || item.status === "done"}
                    placeholder="Label"
                    className="w-full text-xs border-0 bg-transparent focus:outline-none text-stone-700 placeholder:text-stone-300"
                  />
                  {item.error && (
                    <p className="text-xs text-red-500 mt-0.5 line-clamp-2">{item.error}</p>
                  )}
                  {item.status === "done" && item.pageId && (
                    <Link
                      href={`/review/${jobId}/${item.pageId}`}
                      className="text-xs text-teal-600 hover:underline mt-0.5 block"
                    >
                      Review →
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {/* Add more tile */}
            {!running && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-[3/4] border-2 border-dashed border-stone-200 hover:border-stone-300 rounded-xl flex flex-col items-center justify-center text-stone-400 hover:text-stone-500 transition-colors"
              >
                <Upload className="w-6 h-6 mb-1" />
                <span className="text-xs">Add more</span>
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {queue.length === 0 && (
          <div className="text-center py-10 text-stone-400 text-sm">
            Add images above to start a batch upload.
          </div>
        )}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
