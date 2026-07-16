"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function DashboardNav({ user }: { user: User }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-600" />
          <span className="font-semibold text-stone-800">SeferSofer</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500 hidden sm:block">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
