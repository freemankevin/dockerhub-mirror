export function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
            <div className="h-6 w-20 rounded bg-muted" />
          </div>
          <div className="mt-4 h-10 rounded-lg bg-muted" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-16 rounded bg-muted" />
            <div className="h-5 w-24 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
