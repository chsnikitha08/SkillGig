export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={() => onRetry()}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
      <p className="font-medium text-gray-700">{title}</p>
      {children && <div className="mt-2 text-sm text-gray-500">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export function PageTitle({ children, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{children}</h1>
      {action}
    </div>
  );
}
