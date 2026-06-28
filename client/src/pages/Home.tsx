import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-3xl font-bold text-stone-800">{value}</div>
      <div className="text-sm font-medium text-stone-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-stone-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function RecentJobRow({
  job,
  onClick,
}: {
  job: { id: string; name: string; pageCount?: number; updatedAt?: string; accuracy?: number };
  onClick: () => void;
}) {
  const pct = job.accuracy !== undefined ? Math.round(job.accuracy * 100) : null;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition rounded-lg text-left group"
    >
      <div>
        <p className="font-medium text-stone-800 text-sm group-hover:text-teal-700 transition">
          {job.name}
        </p>
        <p className="text-xs text-stone-400 mt-0.5">
          {job.pageCount ?? 0} page{job.pageCount !== 1 ? "s" : ""}
          {job.updatedAt && ` · ${new Date(job.updatedAt).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {pct !== null && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              pct >= 90
                ? "bg-green-100 text-green-700"
                : pct >= 75
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {pct}% accuracy
          </span>
        )}
        <span className="text-stone-300 group-hover:text-teal-400 transition">→</span>
      </div>
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const jobs = trpc.jobs.list.useQuery();
  const latestAccuracy = trpc.ocr.getLatestAccuracy.useQuery();

  const allJobs = jobs.data ?? [];
  const recentJobs = [...allJobs]
    .sort(
      (a, b) =>
        new Date((b as any).updatedAt ?? 0).getTime() - new Date((a as any).updatedAt ?? 0).getTime()
    )
    .slice(0, 5);

  const totalPages = allJobs.reduce((sum: number, j: any) => sum + ((j as any).pageCount ?? 0), 0);
  const latestPct =
    (latestAccuracy.data as any)?.accuracy !== undefined
      ? Math.round((latestAccuracy.data as any).accuracy * 100)
      : null;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 tracking-tight">
              SeferSofer
            </h1>
            <p className="text-sm text-stone-400 mt-0.5">
              Torah manuscript transcription · adaptive OCR
            </p>
          </div>
          <button
            onClick={() => navigate("/new")}
            className="px-5 py-2.5 bg-teal-700 text-white text-sm font-bold rounded-xl hover:bg-teal-800 transition flex items-center gap-2"
          >
            📜 New transcription
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon="📚" label="Total jobs" value={allJobs.length} />
          <StatCard
            icon="📄"
            label="Pages transcribed"
            value={totalPages}
          />
          <StatCard
            icon="🎯"
            label="Latest accuracy"
            value={latestPct !== null ? `${latestPct}%` : "—"}
            sub={latestPct !== null ? (latestPct >= 90 ? "Excellent" : latestPct >= 75 ? "Good" : "Needs review") : "No data yet"}
          />
          <StatCard
            icon="🧠"
            label="System status"
            value="Learning"
            sub="Adaptive OCR active"
          />
        </div>

        {/* Quick actions */}
        <section>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: "📜",
                title: "New transcription",
                desc: "Upload a manuscript page",
                action: () => navigate("/new"),
                primary: true,
              },
              {
                icon: "📊",
                title: "OCR Analytics",
                desc: "View accuracy trends and patterns",
                action: () => navigate("/analytics"),
                primary: false,
              },
              {
                icon: "⚙️",
                title: "Admin panel",
                desc: "Manage clients and workers",
                action: () => navigate("/admin"),
                primary: false,
              },
            ].map((card) => (
              <button
                key={card.title}
                onClick={card.action}
                className={[
                  "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                  card.primary
                    ? "bg-teal-700 border-teal-700 text-white hover:bg-teal-800"
                    : "bg-white border-stone-200 hover:border-teal-300 hover:bg-teal-50",
                ].join(" ")}
              >
                <span className="text-2xl">{card.icon}</span>
                <div>
                  <p className={`font-semibold text-sm ${card.primary ? "text-white" : "text-stone-800"}`}>
                    {card.title}
                  </p>
                  <p className={`text-xs mt-0.5 ${card.primary ? "text-teal-200" : "text-stone-400"}`}>
                    {card.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Recent jobs */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h2 className="font-semibold text-stone-700">Recent jobs</h2>
            <button
              onClick={() => navigate("/jobs")}
              className="text-xs text-teal-700 hover:underline"
            >
              View all →
            </button>
          </div>

          {jobs.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-stone-400 text-sm animate-pulse">Loading jobs…</p>
            </div>
          ) : recentJobs.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-center">
              <span className="text-3xl">📂</span>
              <p className="text-stone-500 font-medium text-sm">No jobs yet</p>
              <p className="text-xs text-stone-400">
                Create a job and upload your first page to get started.
              </p>
              <button
                onClick={() => navigate("/new")}
                className="mt-2 px-4 py-2 text-xs bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition font-semibold"
              >
                Create first job
              </button>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 px-2 py-1">
              {recentJobs.map((job) => (
                <RecentJobRow
                  key={(job as any).id}
                  job={job as any}
                  onClick={() => navigate(`/jobs/${(job as any).id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
