import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export function Toast({
  message,
  type = "success",
  onDismiss,
}: {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const styles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const icons = { success: "✅", error: "❌", info: "ℹ️" };

  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-top-2 ${styles[type]}`}
    >
      <span>{icons[type]}</span>
      {message}
      <button
        onClick={onDismiss}
        className="ml-2 opacity-50 hover:opacity-100 transition text-xs"
      >
        ✕
      </button>
    </div>
  );
}
