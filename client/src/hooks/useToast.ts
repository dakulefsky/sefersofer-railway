import { useState } from "react";
import type { ToastType } from "@/components/ui/Toast";

/**
 * useToast hook for managing toast notifications.
 * Usage:
 *   const { toast, showToast } = useToast();
 *   showToast("Saved successfully!", "success");
 *   {toast && <Toast {...toast} onDismiss={clearToast} />}
 */
export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  function showToast(message: string, type: ToastType = "success") {
    setToast({ message, type });
  }

  function clearToast() {
    setToast(null);
  }

  return { toast, showToast, clearToast };
}
