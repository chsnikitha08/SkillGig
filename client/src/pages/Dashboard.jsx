import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorBanner, PageTitle, Spinner } from '../components/ui';
import { date, money } from '../utils/format';

const GROUPS = [
  ['Needs attention', (g) => g.status === 'accepted' || g.milestones.some((m) => ['submitted', 'disputed'].includes(m.status))],
  ['In progress', (g) => g.status === 'in_progress'],
  ['Open', (g) => g.status === 'open'],
  ['Finished', (g) => ['completed', 'cancelled'].includes(g.status)],
];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/gigs/mine');

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const placed = new Set();
  const groups = GROUPS.map(([title, test]) => {
    const gigs = data.gigs.filter((g) => !placed.has(g._id) && test(g));
    gigs.forEach((g) => placed.add(g._id));
    return [title, gigs];
  }).filter(([, gigs]) => gigs.length);

  return (
    <div>
      <PageTitle
        action={
          user.role === 'client' ? (
            <Link to="/gigs/new" className="btn-primary">
              Post a gig
            </Link>
          ) : (
            <Link to="/gigs" className="btn-primary">
              Find gigs
            </Link>
          )
        }
      >
        {user.role === 'client' ? 'My posted gigs' : 'My work'}
      </PageTitle>

      {!data.gigs.length && (
        <EmptyState title={user.role === 'client' ? 'You have not posted any gigs yet' : 'You have not been hired yet'}>
          {user.role === 'client' ? 'Post a gig and freelancers will start applying.' : 'Browse open gigs and send a few applications.'}
        </EmptyState>
      )}

      <div className="space-y-6">
        {groups.map(([title, gigs]) => (
          <section key={title}>
            <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">{title}</h2>
            <div className="card divide-y divide-gray-100 p-0">
              {gigs.map((g) => (
                <GigRow key={g._id} gig={g} role={user.role} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {data.applications && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">My applications</h2>
          {!data.applications.length ? (
            <EmptyState title="No applications yet" />
          ) : (
            <div className="card divide-y divide-gray-100 p-0">
              {data.applications.map((a) => (
                <Link key={a._id} to={`/gigs/${a.gig?._id}`} className="flex items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-gray-50">
                  <span>{a.gig?.title ?? 'Deleted gig'}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-gray-500">quoted {money(a.quotedPrice)}</span>
                    <StatusBadge status={a.status} kind="application" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function GigRow({ gig, role }) {
  const done = gig.milestones.filter((m) => ['released', 'refunded', 'split'].includes(m.status)).length;
  const other = role === 'client' ? gig.freelancer?.name : gig.client?.name;
  return (
    <Link to={`/gigs/${gig._id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50">
      <div>
        <p className="font-medium">{gig.title}</p>
        <p className="text-xs text-gray-500">
          {other ? `${role === 'client' ? 'Freelancer' : 'Client'}: ${other} · ` : `${gig.applicationCount} applicants · `}
          {gig.milestones.length > 1 ? `${done}/${gig.milestones.length} stages done · ` : ''}due {date(gig.deadline)}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold">{money(gig.agreedAmount ?? gig.budget)}</span>
        <StatusBadge status={gig.status} />
      </div>
    </Link>
  );
}
