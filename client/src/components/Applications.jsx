import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from './StatusBadge';
import { EmptyState, ErrorBanner, Spinner } from './ui';
import { date, money, rating } from '../utils/format';

/** The applicant list a client sees on their own open gig. */
export default function Applications({ gig, onChanged }) {
  const { data, loading, error, reload } = useFetch(`/gigs/${gig._id}/applications`);
  const { run, pending } = useAction();

  if (loading) return <Spinner label="Loading applicants…" />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data.applications.length) return <EmptyState title="No applications yet">Freelancers who apply will show up here.</EmptyState>;

  const accept = async (a) => {
    if (!window.confirm(`Hire ${a.freelancer.name} for ${money(a.quotedPrice)}? All other applicants will be declined.`)) return;
    const ok = await run(() => http.post(`/applications/${a._id}/accept`), `${a.freelancer.name} hired. Fund escrow to let them start.`);
    if (ok) onChanged();
  };

  return (
    <ul className="space-y-3">
      {data.applications.map((a) => (
        <li key={a._id} className="rounded-md border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link to={`/users/${a.freelancer._id}`} className="link font-medium">
                {a.freelancer.name}
              </Link>
              <span className="ml-2 text-xs text-gray-500">
                {rating(a.freelancer)} · {a.freelancer.completedGigs} gigs completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{money(a.quotedPrice)}</span>
              <StatusBadge status={a.status} />
            </div>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{a.pitch}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Applied {date(a.createdAt)}</span>
            {gig.status === 'open' && a.status === 'pending' && (
              <button type="button" className="btn-primary" disabled={pending} onClick={() => accept(a)}>
                Accept & hire
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
