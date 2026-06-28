import { trpc } from "@/lib/trpc";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

function AccuracyGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#22c55e" : pct >= 75 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold border-8"
        style={{ borderColor: color, color }}
      >
        {pct}%
      </div>
      <span className="text-sm text-gray-500">Latest accuracy</span>
    </div>
  );
}

export default function OcrAnalytics() {
  const accuracyTrend = trpc.ocr.getAccuracyTrend.useQuery();
  const letterConfusions = trpc.ocr.getTopLetterConfusions.useQuery();
  const morphologies = trpc.ocr.getTopMorphologies.useQuery();
  const latestAccuracy = trpc.ocr.getLatestAccuracy.useQuery();

  const isLoading =
    accuracyTrend.isLoading ||
    letterConfusions.isLoading ||
    morphologies.isLoading ||
    latestAccuracy.isLoading;

  const hasError =
    accuracyTrend.isError ||
    letterConfusions.isError ||
    morphologies.isError ||
    latestAccuracy.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <LoadingSpinner label="Loading analytics…" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md text-center space-y-3 shadow-sm">
          <div className="text-3xl">⚠️</div>
          <h2 className="font-semibold text-red-700">Analytics unavailable</h2>
          <p className="text-sm text-gray-500">
            Could not load OCR analytics data. Make sure the{" "}
            <code className="bg-gray-100 px-1 rounded text-xs">ocr</code> router
            is exported in <code className="bg-gray-100 px-1 rounded text-xs">appRouter</code>.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const trendData = (accuracyTrend.data ?? []).map((point: any, i: number) => ({
    page: `Page ${i + 1}`,
    accuracy: Math.round((point.accuracy ?? 0) * 100),
  }));

  const confusionData = (letterConfusions.data ?? []).map((c: any) => ({
    pair: `${c.originalLetter}→${c.correctedLetter}`,
    count: c.count,
  }));

  const morphologyData = (morphologies.data ?? []).map((m: any) => ({
    label: `${m.letter} (${m.morphology})`,
    count: m.count,
  }));

  const latest = latestAccuracy.data;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-800 tracking-tight">
              OCR Analytics
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Handwriting recognition accuracy and learning progress
            </p>
          </div>
          {latest && <AccuracyGauge value={(latest as any)?.accuracy ?? 0} />}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Accuracy Trend */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">
            Accuracy over time
          </h2>
          {trendData.length === 0 ? (
            <EmptyState
              icon="📈"
              title="No accuracy data yet"
              detail="Transcribe and review pages to see accuracy improvement here."
            />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="page"
                  tick={{ fontSize: 12, fill: "#78716c" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "#78716c" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, "Accuracy"]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e7e5e4",
                    fontSize: 13,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#0f766e" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Letter Confusions */}
          <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-stone-700 mb-1">
              Letter confusions
            </h2>
            <p className="text-sm text-stone-400 mb-4">
              Most frequently misread letter pairs
            </p>
            {confusionData.length === 0 ? (
              <EmptyState
                icon="🔤"
                title="No confusions recorded yet"
                detail="Make corrections on reviewed pages to train the system."
              />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={confusionData}
                  layout="vertical"
                  margin={{ left: 16, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#78716c" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="pair"
                    tick={{ fontSize: 14, fill: "#292524", fontFamily: "serif" }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    formatter={(v: any) => [v, "Times confused"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 13 }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {confusionData.map((_: any, i: number) => (
                      <Cell
                        key={i}
                        fill={i % 2 === 0 ? "#b45309" : "#d97706"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Morphology Patterns */}
          <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-stone-700 mb-1">
              Visual patterns learned
            </h2>
            <p className="text-sm text-stone-400 mb-4">
              Letter handwriting styles the system has recognized
            </p>
            {morphologyData.length === 0 ? (
              <EmptyState
                icon="✍️"
                title="No visual patterns yet"
                detail="The system learns letter shapes as you correct transcriptions."
              />
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {morphologyData.map((m: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2"
                  >
                    <span
                      className="text-sm text-stone-700 font-medium"
                      dir="rtl"
                    >
                      {m.label}
                    </span>
                    <span className="text-xs bg-teal-100 text-teal-800 rounded-full px-2 py-0.5 font-semibold">
                      ×{m.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Learning Summary */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-stone-700 mb-4">
            How the system learns
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "🔁",
                title: "Letter confusion tracking",
                desc: "Every correction teaches which letters look alike in this manuscript's handwriting.",
              },
              {
                icon: "👁️",
                title: "Visual morphology",
                desc: "Stroke patterns (looped, swirly, connected) are remembered and fed into future prompts.",
              },
              {
                icon: "🛡️",
                title: "Conservative corrections",
                desc: "Only suggestions above 85% confidence are shown. Uncertain words are flagged for your review.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flex flex-col gap-2 bg-stone-50 rounded-lg p-4"
              >
                <span className="text-2xl">{card.icon}</span>
                <p className="font-semibold text-stone-800 text-sm">{card.title}</p>
                <p className="text-xs text-stone-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
