"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertTriangle, Edit3, RotateCcw } from "lucide-react";
import Link from "next/link";

interface Word {
  id: string;
  text: string;
  confidence: number;
  isFlagged: boolean;
  isScribble: boolean;
  isInsertion: boolean;
  wordIndex: number;
}

interface Region {
  id: string;
  regionType: string;
  regionOrder: number;
  words: Word[];
}

interface PageData {
  id: string;
  label?: string;
  pageNumber: number;
  status: string;
  wordCount?: number;
  imageUrl?: string;
  text_regions: Region[];
}

export default function ReviewPage() {
  const { jobId, pageId } = useParams<{ jobId: string; pageId: string }>();
  const router = useRouter();

  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const fetchPage = useCallback(async () => {
    try {
      const res = await fetch(`/api/pages?pageId=${pageId}`);
      if (res.ok) setPageData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  function startEdit(word: Word) {
    setEditingWordId(word.id);
    setEditValue(word.text);
  }

  async function saveCorrection(wordId: string) {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/words/${wordId}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctedText: editValue.trim() }),
      });
      if (res.ok) {
        setSavedWords((prev) => new Set([...prev, wordId]));
        // Update local state
        setPageData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            text_regions: prev.text_regions.map((region) => ({
              ...region,
              words: region.words.map((w) =>
                w.id === wordId ? { ...w, text: editValue.trim(), isFlagged: false } : w
              ),
            })),
          };
        });
        setEditingWordId(null);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 text-sm">Loading page…</div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Page not found.</p>
          <Link href="/dashboard" className="text-teal-600 hover:underline text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const allWords = pageData.text_regions.flatMap((r) => r.words);
  const flaggedCount = allWords.filter((w) => w.isFlagged).length;
  const correctedCount = savedWords.size;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-semibold text-stone-800">
              {pageData.label || `Page ${pageData.pageNumber}`}
            </span>
            <span className="text-xs text-stone-400">{pageData.wordCount} words</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {flaggedCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                {flaggedCount} flagged
              </span>
            )}
            {correctedCount > 0 && (
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckCircle className="w-4 h-4" />
                {correctedCount} corrected
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image panel */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 sticky top-20 self-start">
          <h2 className="text-sm font-medium text-stone-500 mb-3">Original Manuscript</h2>
          {pageData.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pageData.imageUrl}
              alt="Manuscript page"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          ) : (
            <div className="bg-stone-100 rounded-lg h-64 flex items-center justify-center text-stone-400 text-sm">
              Image not available
            </div>
          )}
        </div>

        {/* Transcription panel */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-stone-500 mb-1">Transcription</h2>
            <p className="text-xs text-stone-400">
              Click any word to correct it. Flagged words (amber) need attention.
            </p>
          </div>

          {pageData.text_regions.map((region) => (
            <div key={region.id}>
              {region.regionType !== "main" && (
                <div className="text-xs text-stone-400 uppercase tracking-wide mb-2">
                  {region.regionType.replace("_", " ")}
                </div>
              )}
              <div
                className="bg-white rounded-xl border border-stone-200 p-5 flex flex-wrap gap-2 justify-end"
                dir="rtl"
              >
                {region.words.map((word) => (
                  <div key={word.id} className="relative group">
                    {editingWordId === word.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          dir="rtl"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveCorrection(word.id);
                            if (e.key === "Escape") setEditingWordId(null);
                          }}
                          className="border border-teal-400 rounded px-2 py-0.5 text-sm font-hebrew focus:outline-none focus:ring-2 focus:ring-teal-300 w-24 text-right"
                        />
                        <button
                          onClick={() => saveCorrection(word.id)}
                          disabled={saving}
                          className="text-teal-600 hover:text-teal-800"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingWordId(null)}
                          className="text-stone-400 hover:text-stone-600"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(word)}
                        className={`relative px-2 py-1 rounded-lg text-base font-hebrew transition-all hover:scale-105 ${
                          savedWords.has(word.id)
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : word.isFlagged
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-stone-50 text-stone-800 border border-stone-100 hover:border-stone-300"
                        }`}
                        title={`Confidence: ${Math.round((word.confidence || 0) * 100)}%`}
                      >
                        {word.text}
                        <span className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Edit3 className="w-2.5 h-2.5 text-stone-400" />
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Done button */}
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
}
