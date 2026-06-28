export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="text-4xl animate-pulse">📜</div>
      <p className="text-stone-400 text-sm font-medium">{label}</p>
    </div>
  );
}
