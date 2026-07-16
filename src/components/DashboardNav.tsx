"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const initials = user.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  return (
    <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo + breadcrumb nav */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100"
            title="Home"
          >
            <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-stone-900 text-sm tracking-tight hidden sm:block">SeferSofer</span>
          </Link>

          {/* Breadcrumb separator */}
          <span className="text-stone-300 text-lg">/</span>

          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
              pathname === "/dashboard"
                ? "text-teal-700 bg-teal-50 font-medium"
                : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:block">Dashboard</span>
          </Link>
        </div>

        {/* Right: user avatar + sign out */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center">
              <span className="text-[10px] font-bold text-teal-700">{initials}</span>
            </div>
            <span className="text-xs text-stone-400 truncate max-w-[160px]">
              {user.email}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-red-600 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
