import Link from "next/link";
import { BookOpen, Upload, Search, ArrowLeft } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-stone-50 to-teal-50">
      {/* Nav */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-teal-600" />
            <span className="font-semibold text-lg text-stone-800">SeferSofer</span>
            <span className="text-xs text-stone-400 font-hebrew">ספר סופר</span>
          </div>
          <Link
            href="/dashboard"
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Open App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span>Powered by GPT-4o Vision</span>
        </div>
        <h1 className="text-5xl font-bold text-stone-900 leading-tight mb-6">
          Transcribe Hebrew<br />
          <span className="text-teal-600">Handwritten Manuscripts</span>
        </h1>
        <p className="text-xl text-stone-500 max-w-2xl mx-auto mb-10">
          Upload manuscript images and get accurate word-level transcriptions of
          modern Hebrew handwriting — with confidence scores and a correction interface.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2"
          >
            Get Started
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Link>
          <a
            href="https://github.com/dakulefsky/sefersofer-railway"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-stone-300 hover:border-stone-400 text-stone-700 font-medium px-8 py-3 rounded-xl transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Upload,
              title: "Upload & Transcribe",
              desc: "Upload manuscript images. GPT-4o Vision reads the Hebrew handwriting and returns word-level results with confidence scores.",
            },
            {
              icon: Search,
              title: "Review & Correct",
              desc: "Review flagged words inline. Every correction you make trains the system to improve over time.",
            },
            {
              icon: BookOpen,
              title: "Organize by Job",
              desc: "Group pages into jobs — one per notebook, letter collection, or archive. Navigate your entire corpus easily.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="font-semibold text-stone-800 mb-2">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
