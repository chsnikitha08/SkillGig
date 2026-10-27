import { useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, PageTitle, Spinner } from '../components/ui';
import { date, money } from '../utils/format';

/** Admins get platform stats + every dispute; users get the disputes they are part of. */
export default function Disputes() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [status, setStatus] = useState(isAdmin ? 'open' : 'all');
  const { data, loading, error, reload } = useFetch(`/disputes?status=${status}`);

  return (
    <div className="space-y-6">
      <PageTitle>{isAdmin ? 'Admin · Disputes' : 'My disputes'}</PageTitle>
      {isAdmin && <AdminStats />}
      <div className="flex gap-2">
        {['open', 'resolved', 'all'].map((s) => (
          <button key={s} type="button" className={status === s ? 'btn-primary' : 'btn-secondary'} onClick={() => setStatus(s)}>
            {s}
          </button>
        ))}
      </div>
      <ErrorBanner message={error} onRetry={reload} />
      {loading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title={`No ${status === 'all' ? '' : status} disputes`}>{isAdmin ? 'Nothing needs your attention.' : 'Good news!'}</EmptyState>
      ) : (
        <div className="card divide-y divide-gray-100 p-0">
          {data.items.map((d) => (
            <Link key={d._id} to={`/disputes/${d._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50">
              <div>
                <p className="font-medium">
                  {d.gig?.title} · {d.milestoneTitle}
                </p>
                <p className="text-xs text-gray-500">
                  Raised by {d.raisedBy.name} ({d.raisedBy.role}) on {date(d.createdAt)}
                  {!d.response && d.status === 'open' && ' · awaiting response'}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold">{money(d.amount)}</span>
                <StatusBadge status={d.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminStats() {
  const { data, error, reload } = useFetch('/admin/stats');
  const { run, pending } = useAction();
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  if (!data) return null;
  const { ledger } = data;
  const tiles = [
    ['Users', Object.values(data.users).reduce((a, b) => a + b, 0)],
    ['Active gigs', (data.gigs.in_progress ?? 0) + (data.gigs.accepted ?? 0)],
    ['Open disputes', data.openDisputes],
    ['Payments on hold', money(ledger.inEscrow)],
  ];
  const retry = async (id) => {
    const res = await run(() => http.post(`/admin/refunds/${id}/retry`));
    if (res) reload();
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <p className={`rounded-md px-3 py-2 text-sm ${ledger.balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
        {ledger.balanced ? '✓ All payments accounted for' : '✗ Payment records do not add up. Investigate.'} · {money(ledger.paidIn)} received ={' '}
        {money(ledger.inEscrow)} on hold + {money(ledger.released)} paid to freelancers + {money(ledger.refunded)} refunded
      </p>
      {data.failedRefunds.length > 0 && (
        <div className="card border-red-200">
          <p className="mb-2 text-sm font-semibold text-red-700">Refunds that need attention (retried automatically every 5 minutes)</p>
          {data.failedRefunds.map((r) => (
            <div key={r._id} className="flex items-center justify-between gap-2 py-1 text-sm">
              <span>
                {money(r.amount)} · {r.gig?.title} · {r.attempts} attempts · <span className="text-red-700">{r.lastError}</span>
              </span>
              <button type="button" className="btn-secondary" disabled={pending} onClick={() => retry(r._id)}>
                Retry now
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
