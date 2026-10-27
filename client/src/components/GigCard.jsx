import { Clock, Layers, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import { categoryOf } from '../utils/categories';
import { money, timeLeft } from '../utils/format';

export default function GigCard({ gig }) {
  const cat = categoryOf(gig.skillsRequired);
  const Icon = cat.icon;
  const client = gig.client;
  const avg = client?.ratingCount ? (client.ratingSum / client.ratingCount).toFixed(1) : null;

  return (
    <Link
      to={`/gigs/${gig._id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${cat.gradient}`}>
        <Icon className="h-12 w-12 text-white drop-shadow-sm transition group-hover:scale-110" strokeWidth={1.5} />
        {gig.status !== 'open' && (
          <span className="absolute right-3 top-3">
            <StatusBadge status={gig.status} />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-gray-500">{cat.name}</p>
        <h3 className="mt-1 line-clamp-2 font-semibold leading-snug text-ink group-hover:text-brand-700">{gig.title}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {timeLeft(gig.deadline)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {gig.applicationCount} applied
          </span>
          {gig.milestones.length > 1 && (
            <span className="inline-flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> {gig.milestones.length} stages
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 mt-4">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Avatar name={client?.name} size="h-7 w-7 text-[10px]" />
            <span className="truncate text-gray-700">{client?.name}</span>
            {avg && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {avg}
              </span>
            )}
          </span>
          <span className="whitespace-nowrap text-xs text-gray-500">
            Budget <span className="text-base font-semibold text-ink">{money(gig.budget)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
