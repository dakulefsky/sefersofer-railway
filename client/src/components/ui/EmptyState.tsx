export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon: string;
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
      <span className="text-5xl">{icon}</span>
      <p className="font-semibold text-stone-600 text-lg">{title}</p>
      {detail && <p className="text-sm text-stone-400 max-w-xs">{detail}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-5 py-2 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
