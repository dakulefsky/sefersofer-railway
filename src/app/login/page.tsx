"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BookOpen, Loader2, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "signup" && password.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      setLoading(false);
      return;
    }

    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Account created! Check your email for a confirmation link.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-teal-50/50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-stone-900 tracking-tight">SeferSofer</span>
          </div>

          <h1 className="text-xl font-bold text-stone-900 mb-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-stone-500 text-sm mb-6">
            {mode === "login"
              ? "Sign in to continue transcribing."
              : "Start transcribing Hebrew manuscripts with AI."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-stone-300 transition-shadow"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent placeholder:text-stone-300 transition-shadow"
                placeholder="••••••••"
              />
              {mode === "signup" && (
                <p className="text-xs text-stone-400 mt-1">Minimum 6 characters</p>
              )}
            </div>

            {message && (
              <div
                className={`text-sm rounded-lg p-3 ${
                  message.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-green-50 text-green-700 border border-green-200"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-stone-100 text-center">
            <p className="text-sm text-stone-500">
              {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
              <button
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
                className="text-teal-600 hover:text-teal-700 font-medium transition-colors"
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
