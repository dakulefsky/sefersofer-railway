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

  return (
    <nav className="bg-white border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo + breadcrumb nav */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100"
            title="Home"
          >
            <BookOpen className="w-5 h-5 text-teal-600" />
            <span className="font-semibold text-stone-800 hidden sm:block">SeferSofer</span>
          </Link>

          {/* Breadcrumb separator */}
          <span className="text-stone-300 text-lg">/</span>

          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg transition-colors ${
              pathname === "/dashboard"
                ? "text-teal-700 bg-teal-50 font-medium"
                : "text-stone-500 hover:text-stone-700 hover:bg-stone-100"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:block">Dashboard</span>
          </Link>
        </div>

        {/* Right: user email + sign out */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-400 hidden md:block truncate max-w-[200px]">
            {user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
