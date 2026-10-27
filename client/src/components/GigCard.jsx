import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { money, rating, timeLeft } from '../utils/format';

export default function GigCard({ gig }) {
  return (
    <Link to={`/gigs/${gig._id}`} className="card block transition hover:border-indigo-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{gig.title}</h3>
        <span className="whitespace-nowrap font-semibold text-indigo-700">{money(gig.budget)}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{gig.description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {gig.skillsRequired.map((s) => (
          <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            {s}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          {gig.client?.name} · {rating(gig.client)}
        </span>
        <span className="flex items-center gap-2">
          {gig.milestones.length > 1 && <span>{gig.milestones.length} stages</span>}
          <span>{gig.applicationCount} applied</span>
          <span>{timeLeft(gig.deadline)}</span>
          {gig.status !== 'open' && <StatusBadge status={gig.status} />}
        </span>
      </div>
    </Link>
  );
}
