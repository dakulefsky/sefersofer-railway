"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Upload, ImageIcon, Loader2, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

type UploadStatus = "idle" | "uploading" | "transcribing" | "done" | "error";

export default function TranscribePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
        </div>
      }
    >
      <TranscribePage />
    </Suspense>
  );
}

function TranscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!jobId) router.replace("/dashboard");
  }, [jobId, router]);

  function handleFileSelect(selected: File) {
    if (!selected.type.startsWith("image/")) {
      setErrorMsg("Please select an image file (JPEG, PNG, or WebP).");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setErrorMsg("File must be under 20 MB.");
      return;
    }
    setFile(selected);
    setErrorMsg("");
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !jobId) return;

    setStatus("uploading");
    setErrorMsg("");

    try {
      // Step 1: Create page record + get signed upload URL
      const createRes = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          label: label || file.name,
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create page");
      }

      const { page, uploadUrl } = await createRes.json();

      // Step 2: Upload image directly to Supabase Storage
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload image to storage");
      }

      // Step 3: Convert image to base64 and call transcription API
      setStatus("transcribing");

      const base64 = await fileToBase64(file);

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          imageBase64: base64,
          mimeType: file.type,
        }),
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error || "Transcription failed");
      }

      setStatus("done");

      // Navigate to review after short delay
      setTimeout(() => {
        router.push(`/review/${jobId}/${page.id}`);
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Back bar */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-xl mx-auto px-6 h-12 flex items-center">
          <Link
            href={jobId ? `/jobs/${jobId}` : "/dashboard"}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to job
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 pt-10">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm w-full max-w-xl p-8">
          <h1 className="text-xl font-bold text-stone-900 mb-1">Upload Manuscript Page</h1>
          <p className="text-stone-500 text-sm mb-6">
            Upload a clear image of a handwritten Hebrew page. GPT-4o will transcribe it.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFileSelect(dropped);
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-teal-400 bg-teal-50"
                  : preview
                  ? "border-teal-300 bg-teal-50"
                  : "border-stone-200 hover:border-stone-300"
              }`}
            >
              {preview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-48 mx-auto rounded-lg object-contain"
                  />
                  <p className="text-xs text-stone-500 mt-2">{file?.name}</p>
                </div>
              ) : (
                <div>
                  <ImageIcon className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-stone-600">
                    Drop image here or click to browse
                  </p>
                  <p className="text-xs text-stone-400 mt-1">JPEG, PNG, WebP — max 20 MB</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Page label <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Letter 3, Page 12, Folio 7r"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Status */}
            {status === "done" && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                <CheckCircle className="w-4 h-4" />
                Transcription complete! Redirecting to review…
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!file || status === "uploading" || status === "transcribing" || status === "done"}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {status === "uploading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading image…</>
              ) : status === "transcribing" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Transcribing with GPT-4o…</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload &amp; Transcribe</>
              )}
            </button>
          </form>
        </div>
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
