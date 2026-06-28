import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";

interface WordTokenProps {
  word: {
    id: string;
    text: string;
    confidence?: number;
    isScribble?: boolean;
    isFlagged?: boolean;
    index: number;
  };
  jobId: string;
  pageId: string;
  onUpdate?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 90
      ? "bg-green-100 text-green-700"
      : pct >= 75
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${color}`}>
      {pct}%
    </span>
  );
}

export function WordToken({ word, jobId, pageId, onUpdate }: WordTokenProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(word.text);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // TODO: Wire markScribble mutation once corrections router is implemented
  const markScribble = {
    mutate: () => {},
    isSuccess: false,
    isPending: false,
  };

  // TODO: Wire saveCorrection mutation once corrections router is implemented
  const saveCorrection = {
    mutate: () => {},
    isPending: false,
  };

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      handleMarkScribble();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleMarkScribble() {
    markScribble.mutate();
  }

  function handleSave() {
    if (editValue.trim() === word.text) {
      setEditing(false);
      return;
    }
    saveCorrection.mutate();
  }

  const isScribble = word.isScribble || markScribble.isSuccess;
  const isFlagged = word.isFlagged && !isScribble;
  const confidence = word.confidence;

  const tokenClass = [
    "relative inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg border cursor-pointer select-none transition-all focus:outline-none focus:ring-2 focus:ring-teal-400",
    isScribble
      ? "bg-stone-100 border-stone-200 opacity-50 line-through text-stone-400"
      : isFlagged
      ? "bg-amber-50 border-amber-300 text-amber-800"
      : "bg-white border-stone-200 text-stone-800 hover:border-teal-300 hover:bg-teal-50",
  ].join(" ");

  return (
    <div
      className={tokenClass}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={
        isScribble
          ? "Marked as scribble"
          : isFlagged
          ? "Flagged for review — low confidence"
          : undefined
      }
      dir="rtl"
    >
      {/* Tooltip */}
      {showTooltip && !editing && (
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
          {isScribble
            ? "Scribble / noise"
            : isFlagged
            ? `Low confidence — flagged`
            : confidence !== undefined
            ? `Confidence: ${Math.round(confidence * 100)}%`
            : "Click to edit · S = mark scribble"}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800" />
        </div>
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditValue(word.text);
              setEditing(false);
            }
          }}
          className="text-base font-serif text-right bg-transparent border-none outline-none w-auto min-w-[2rem]"
          style={{ width: `${Math.max(editValue.length, 2) + 1}ch` }}
          dir="rtl"
          autoFocus
        />
      ) : (
        <span
          className="text-base font-serif"
          onClick={() => {
            if (!isScribble) {
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          {word.text}
        </span>
      )}

      {/* Bottom row: confidence badge + scribble button */}
      {!editing && (
        <div className="flex items-center gap-1">
          {confidence !== undefined && !isScribble && (
            <ConfidenceBadge confidence={confidence} />
          )}
          {!isScribble && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkScribble();
              }}
              title="Mark as scribble/noise (S)"
              className="text-[10px] text-stone-300 hover:text-red-400 transition px-1"
            >
              ✕
            </button>
          )}
          {isScribble && (
            <span className="text-[10px] text-stone-400">scribble</span>
          )}
        </div>
      )}

      {/* Flagged indicator */}
      {isFlagged && !isScribble && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
      )}
    </div>
  );
}
