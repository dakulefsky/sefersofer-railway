// Full page review UI:
//   - Manuscript image panel (left)
//   - Annotation-aware text panel (right):
//       • Main text (right-to-left word stream)
//       • Margin notes (right, left, top, bottom) in distinct styled lanes
//       • Interlinear insertions rendered inline with ^ caret indicator
//   - Progress bar, keyboard shortcuts, complete button
//   - Corrections and scribble marking wired to tRPC

import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth";
import { WordToken } from "@/components/WordToken";
import {
  KeyboardLegend,
  ReviewProgress,
  CompleteButton,
  ScanAnotherPageModal,
} from "@/components/PageReviewExtras";

type RegionType =
  | "main"
  | "margin_right"
  | "margin_left"
  | "margin_top"
  | "margin_bottom"
  | "interlinear";

interface Word {
  id: string;
  text: string;
  confidence?: number;
  is_flagged: boolean;
  is_scribble: boolean;
  is_insertion: boolean;
  word_index: number;
  region_id: string | null;
}

interface Region {
  id: string;
  region_type: RegionType;
  anchor_word_index: number | null;
}

const REGION_LABELS: Record<RegionType, string> = {
  main: "Main Text",
  margin_right: "Right Margin",
  margin_left: "Left Margin",
  margin_top: "Top Margin",
  margin_bottom: "Bottom Margin",
  interlinear: "Interlinear",
};

const REGION_STYLES: Record<RegionType, string> = {
  main: "",
  margin_right:
    "border border-amber-200 bg-amber-50/60 rounded-xl px-3 py-2",
  margin_left:
    "border border-sky-200 bg-sky-50/60 rounded-xl px-3 py-2",
  margin_top:
    "border border-violet-200 bg-violet-50/60 rounded-xl px-3 py-2",
  margin_bottom:
    "border border-rose-200 bg-rose-50/60 rounded-xl px-3 py-2",
  interlinear:
    "border border-teal-200 bg-teal-50/60 rounded-xl px-3 py-2",
};

const REGION_LABEL_STYLES: Record<RegionType, string> = {
  main: "text-stone-400",
  margin_right: "text-amber-600",
  margin_left: "text-sky-600",
  margin_top: "text-violet-600",
  margin_bottom: "text-rose-600",
  interlinear: "text-teal-600",
};

function RegionLane({
  region,
  words,
  jobId,
  pageId,
  onWordUpdate,
}: {
  region: Region;
  words: Word[];
  jobId: string;
  pageId: string;
  onWordUpdate: () => void;
}) {
  const isInterlinear = region.region_type === "interlinear";
  const label = REGION_LABELS[region.region_type];
  const style = REGION_STYLES[region.region_type];
  const labelStyle = REGION_LABEL_STYLES[region.region_type];

  return (
    <div className={`space-y-1 ${style}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${labelStyle} mb-1`}>
        {isInterlinear && region.anchor_word_index != null && (
          <span className="font-mono text-teal-500">^{region.anchor_word_index + 1}</span>
        )}
        <span>{label}</span>
      </div>
      <div
        className="flex flex-wrap gap-1.5 justify-end"
        dir="rtl"
      >
        {words.map((word) => (
          <WordToken
            key={word.id}
            word={{
              id: word.id,
              text: word.text,
              confidence: word.confidence,
              isScribble: word.is_scribble,
              isFlagged: word.is_flagged,
              index: word.word_index,
            }}
            jobId={jobId}
            pageId={pageId}
            onUpdate={onWordUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function ImagePanel({
  imageUrl,
  pageLabel,
}: {
  imageUrl: string | null;
  pageLabel: string | null;
}) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col h-full bg-stone-900 rounded-2xl overflow-hidden border border-stone-700">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-800 border-b border-stone-700">
        <span className="text-xs text-stone-400 font-medium">
          {pageLabel ?? "Manuscript page"}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="text-stone-400 hover:text-white text-sm px-2 py-0.5 rounded transition"
          >
            −
          </button>
          <span className="text-xs text-stone-400 w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="text-stone-400 hover:text-white text-sm px-2 py-0.5 rounded transition"
          >
            +
          </button>
          <button
            onClick={() => setZoom(1)}
            className="text-xs text-stone-500 hover:text-stone-300 px-2 py-0.5 rounded transition"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Manuscript page"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            className="transition-transform duration-200 max-w-none rounded shadow-xl"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-3">
            <span className="text-4xl">📄</span>
            <span className="text-sm">No image available</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PageReview() {
  const params = useParams<{ jobId: string; pageId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const correctedWordsRef = useRef(0);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  // Fetch page data (page + regions + words)
  const pageQuery = trpc.pages.getPage.useQuery(
    { pageId: params.pageId || "" },
    { enabled: !!params.pageId }
  );

  const completePage = trpc.corrections.completePage.useMutation({
    onSuccess: () => setScanModalOpen(true),
  });

  // Keyboard shortcut: Ctrl+Enter to complete
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        handleComplete();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleWordUpdate = useCallback(() => {
    correctedWordsRef.current += 1;
    // Refetch to get latest word states
    pageQuery.refetch();
  }, [pageQuery]);

  function handleComplete() {
    if (!pageQuery.data) return;
    const allWords = pageQuery.data.words as Word[];
    completePage.mutate({
      jobId: params.jobId || "",
      pageId: params.pageId || "",
      totalWords: allWords.length,
      correctedWords: correctedWordsRef.current,
    });
  }

  if (pageQuery.isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-stone-400">
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading page…</span>
        </div>
      </div>
    );
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-stone-600">Could not load this page.</p>
          <button
            onClick={() => navigate(`/job/${params.jobId}`)}
            className="text-teal-700 text-sm underline"
          >
            Back to job
          </button>
        </div>
      </div>
    );
  }

  const { page, regions, wordsByRegion, words } = pageQuery.data as {
    page: any;
    regions: Region[];
    wordsByRegion: Record<string, Word[]>;
    words: Word[];
  };

  // Stats for progress bar
  const totalWords = words.length;
  const scribbleCount = words.filter((w) => w.is_scribble).length;
  const flaggedCount = words.filter((w) => w.is_flagged && !w.is_scribble).length;
  const approvedCount = totalWords - flaggedCount - scribbleCount;

  // Separate regions by type for spatial layout
  const regionsByType = (type: RegionType) =>
    regions.filter((r) => r.region_type === type);

  const renderRegions = (types: RegionType[]) =>
    types.flatMap((type) =>
      regionsByType(type).map((region) => {
        const regionWords = wordsByRegion[region.id] ?? [];
        if (regionWords.length === 0) return null;
        return (
          <RegionLane
            key={region.id}
            region={region}
            words={regionWords}
            jobId={params.jobId || ""}
            pageId={params.pageId || ""}
            onWordUpdate={handleWordUpdate}
          />
        );
      })
    );

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-stone-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/job/${params.jobId}`)}
              className="text-stone-400 hover:text-stone-600 transition text-sm"
            >
              ← Back
            </button>
            <span className="text-stone-200">|</span>
            <h1 className="text-sm font-semibold text-stone-700">
              {page.page_label ?? `Page ${page.page_order}`}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <KeyboardLegend />
            <CompleteButton
              onClick={handleComplete}
              isPending={completePage.isPending}
              disabled={totalWords === 0}
            />
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <ReviewProgress
        approvedCount={approvedCount}
        totalCount={totalWords}
        flaggedCount={flaggedCount}
        scribbleCount={scribbleCount}
      />

      {/* Region legend */}
      {regions.length > 1 && (
        <div className="bg-white border-b border-stone-100 px-6 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap text-xs">
            <span className="text-stone-400 font-medium">Regions:</span>
            {(["main", "margin_right", "margin_left", "interlinear", "margin_top", "margin_bottom"] as RegionType[])
              .filter((t) => regions.some((r) => r.region_type === t))
              .map((t) => (
                <span key={t} className={`font-medium ${REGION_LABEL_STYLES[t]}`}>
                  ● {REGION_LABELS[t]}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Main content: image + text panels */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full px-6 py-5 gap-6 min-h-0">
        {/* Left: image */}
        <div className="w-1/2 min-h-[60vh]">
          <ImagePanel imageUrl={page.imageUrl} pageLabel={page.page_label} />
        </div>

        {/* Right: annotation panel */}
        <div className="w-1/2 flex flex-col gap-4 overflow-y-auto">

          {/* Top margin */}
          {renderRegions(["margin_top"])}

          {/* Right margin */}
          {renderRegions(["margin_right"])}

          {/* Main text + interlinear insertions interwoven */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                Main Text
              </span>
              <span className="text-xs text-stone-300">right-to-left</span>
            </div>

            {/* Interlinear insertions above the main text */}
            {renderRegions(["interlinear"])}

            {/* Main text words */}
            {regionsByType("main").map((region) => {
              const regionWords = wordsByRegion[region.id] ?? [];
              return (
                <div
                  key={region.id}
                  className="flex flex-wrap gap-2 justify-end"
                  dir="rtl"
                >
                  {regionWords.map((word) => (
                    <WordToken
                      key={word.id}
                      word={{
                        id: word.id,
                        text: word.text,
                        confidence: word.confidence,
                        isScribble: word.is_scribble,
                        isFlagged: word.is_flagged,
                        index: word.word_index,
                      }}
                      jobId={params.jobId || ""}
                      pageId={params.pageId || ""}
                      onUpdate={handleWordUpdate}
                    />
                  ))}
                </div>
              );
            })}

            {/* Unassigned words (no region yet) */}
            {(wordsByRegion["unassigned"] ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
                {(wordsByRegion["unassigned"] ?? []).map((word) => (
                  <WordToken
                    key={word.id}
                    word={{
                      id: word.id,
                      text: word.text,
                      confidence: word.confidence,
                      isScribble: word.is_scribble,
                      isFlagged: word.is_flagged,
                      index: word.word_index,
                    }}
                    jobId={params.jobId || ""}
                    pageId={params.pageId || ""}
                    onUpdate={handleWordUpdate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Left margin */}
          {renderRegions(["margin_left"])}

          {/* Bottom margin */}
          {renderRegions(["margin_bottom"])}

        </div>
      </div>

      {/* Scan next page modal */}
      <ScanAnotherPageModal
        open={scanModalOpen}
        onClose={() => { setScanModalOpen(false); navigate(`/job/${params.jobId}`); }}
        onScan={(file) => {
          // TODO: call trpc.pages.uploadAndCreate with signed URL from Supabase Storage
          console.log("Upload next page:", file.name);
          setScanModalOpen(false);
          navigate(`/job/${params.jobId}`);
        }}
        nextPageOrder={(page.page_order ?? 0) + 1}
        jobId={params.jobId || ""}
      />
    </div>
  );
}
