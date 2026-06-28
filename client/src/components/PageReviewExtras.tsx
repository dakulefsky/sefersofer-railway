import { useState, useRef } from "react";

export function KeyboardLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 transition"
        title="Keyboard shortcuts"
      >
        ⌨️ Shortcuts
      </button>
      {open && (
        <div className="absolute right-0 top-7 bg-white border border-stone-200 rounded-xl shadow-lg p-4 z-20 w-56 text-xs text-stone-600 space-y-2">
          <p className="font-semibold text-stone-700 mb-1">Keyboard shortcuts</p>
          {[
            ["Tab / Shift+Tab", "Navigate words"],
            ["Enter", "Edit focused word"],
            ["Escape", "Cancel edit"],
            ["S", "Mark as scribble"],
            ["Ctrl+Enter", "Complete page review"],
          ].map(([key, desc]) => (
            <div key={key} className="flex justify-between gap-2">
              <kbd className="bg-stone-100 rounded px-1.5 py-0.5 font-mono text-[10px]">
                {key}
              </kbd>
              <span className="text-stone-500 text-right">{desc}</span>
            </div>
          ))}
          <p className="text-stone-400 text-[10px] pt-1 border-t border-stone-100">
            Focus any word first by clicking it.
          </p>
        </div>
      )}
    </div>
  );
}

export function ReviewProgress({
  approvedCount,
  totalCount,
  flaggedCount,
  scribbleCount,
}: {
  approvedCount: number;
  totalCount: number;
  flaggedCount: number;
  scribbleCount: number;
}) {
  const pct = totalCount === 0 ? 0 : Math.round((approvedCount / totalCount) * 100);
  return (
    <div className="px-6 py-3 bg-white border-b border-stone-100">
      <div className="max-w-5xl mx-auto flex items-center gap-4">
        <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-teal-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500 shrink-0">
          <span>
            <strong className="text-stone-700">{approvedCount}</strong>/{totalCount} reviewed
          </span>
          {flaggedCount > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {flaggedCount} flagged
            </span>
          )}
          {scribbleCount > 0 && (
            <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
              {scribbleCount} scribbles
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CompleteButton({
  onClick,
  isPending,
  disabled,
}: {
  onClick: () => void;
  isPending: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isPending || disabled}
      className="flex items-center gap-2 px-5 py-2 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      title="Complete review (Ctrl+Enter)"
    >
      {isPending ? (
        <>
          <span className="animate-spin">⏳</span> Saving…
        </>
      ) : (
        <>✓ Complete page</>
      )}
    </button>
  );
}

export function ScanAnotherPageModal({
  open,
  onClose,
  onScan,
  nextPageOrder,
  jobId,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (file: File) => void;
  nextPageOrder: number;
  jobId: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-md w-full mx-4 border border-stone-200">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-stone-800">Scan next page</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-stone-500 mb-4">
          Page <strong>{nextPageOrder}</strong> will be added to this job automatically.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => uploadRef.current?.click()}
          className={[
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            dragOver
              ? "border-teal-400 bg-teal-50"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-stone-200 hover:border-stone-400",
          ].join(" ")}
        >
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          {selectedFile ? (
            <div className="space-y-1">
              <div className="text-3xl">📄</div>
              <p className="font-medium text-green-700 text-sm">{selectedFile.name}</p>
              <p className="text-xs text-stone-400">
                {(selectedFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">📷</div>
              <p className="text-sm text-stone-500">
                Drop an image here, or{" "}
                <span className="text-teal-700 font-medium underline">browse</span>
              </p>
              <p className="text-xs text-stone-400">PNG, JPG, TIFF accepted</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedFile) onScan(selectedFile);
            }}
            disabled={!selectedFile}
            className="px-5 py-2 text-sm text-white bg-teal-700 rounded-lg hover:bg-teal-800 transition disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
          >
            Transcribe page {nextPageOrder}
          </button>
        </div>
      </div>
    </div>
  );
}
