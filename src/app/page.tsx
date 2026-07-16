import Link from "next/link";
import {
  BookOpen,
  Upload,
  Eye,
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Languages,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-white to-teal-50/30">
      {/* Nav */}
      <header className="border-b border-stone-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-stone-900 tracking-tight">
              SeferSofer
            </span>
            <span className="text-xs text-stone-400 font-hebrew">ספר סופר</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-stone-600 hover:text-stone-900 transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-sm bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-full px-4 py-1.5 text-sm text-teal-700 font-medium mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          Powered by GPT-4o Vision
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-900 leading-tight max-w-4xl mx-auto mb-6">
          Transcribe Handwritten Hebrew
          <span className="text-teal-600"> Manuscripts</span> with AI
        </h1>
        <p className="text-lg sm:text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload a photo of handwritten Hebrew text. Get an accurate, word-level
          transcription in seconds — then review and correct with our
          purpose-built editor.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-teal-200 active:scale-[0.97]"
          >
            Start Transcribing
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 font-medium px-6 py-3.5 rounded-xl border border-stone-200 hover:border-stone-300 transition-colors"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 text-center mb-4">
          Three Steps to Transcription
        </h2>
        <p className="text-stone-500 text-center mb-14 max-w-lg mx-auto">
          From photograph to searchable text in minutes, not hours.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Upload,
              step: "01",
              title: "Upload",
              desc: "Take a photo or scan of any handwritten Hebrew page. Supports JPEG, PNG, and WebP up to 20 MB.",
            },
            {
              icon: Sparkles,
              step: "02",
              title: "Transcribe",
              desc: "GPT-4o Vision analyzes the image and produces a word-level transcription with confidence scores.",
            },
            {
              icon: Eye,
              step: "03",
              title: "Review & Correct",
              desc: "Our purpose-built editor highlights uncertain words. Click to correct — your edits improve future accuracy.",
            },
          ].map(({ icon: Icon, step, title, desc }) => (
            <div
              key={step}
              className="bg-white rounded-2xl border border-stone-200 p-7 hover:shadow-lg hover:border-teal-200 transition-all group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center group-hover:bg-teal-100 transition-colors">
                  <Icon className="w-5 h-5 text-teal-600" />
                </div>
                <span className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Step {step}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">{title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-stone-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 text-center mb-14">
            Built for Hebrew Manuscripts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Languages,
                title: "RTL-Native",
                desc: "Right-to-left rendering, Hebrew fonts, and proper Unicode handling throughout.",
              },
              {
                icon: Zap,
                title: "Batch Processing",
                desc: "Upload dozens of pages at once. Each is transcribed sequentially with progress tracking.",
              },
              {
                icon: Shield,
                title: "Secure Storage",
                desc: "Images stored in encrypted Supabase Storage. Only you can access your manuscripts.",
              },
              {
                icon: Eye,
                title: "Confidence Scoring",
                desc: "Every word gets a confidence score. Low-confidence words are flagged for your review.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center p-5">
                <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="font-semibold text-stone-900 mb-2">{title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-4">
          Ready to Digitize Your Manuscripts?
        </h2>
        <p className="text-stone-500 mb-8 max-w-lg mx-auto">
          Create a free account and transcribe your first page in under a minute.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-teal-200 active:scale-[0.97]"
        >
          Get Started Free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-stone-400">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-500" />
            <span>SeferSofer</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/dakulefsky/sefersofer-railway"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-600 transition-colors"
            >
              GitHub
            </a>
            <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
