import { Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import GigCard from '../components/GigCard';
import { EmptyState, ErrorBanner, Spinner } from '../components/ui';
import { CATEGORIES } from '../utils/categories';

const FILTERS = ['q', 'skill', 'min', 'max', 'sort'];

export default function Gigs() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])));
  const apiParams = new URLSearchParams(params);
  apiParams.delete('cat'); // display-only
  const { data, loading, error, reload } = useFetch(`/gigs?${apiParams.toString()}`);
  const page = Number(params.get('page') || 1);
  const activeCat = CATEGORIES.find((c) => c.key === params.get('cat'));

  const apply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    FILTERS.forEach((k) => form[k] && next.set(k, form[k]));
    if (activeCat && form.skill === activeCat.skills.join(',')) next.set('cat', activeCat.key);
    setParams(next);
  };
  const pickCategory = (c) => {
    const next = new URLSearchParams();
    if (form.q) next.set('q', form.q);
    if (c) {
      next.set('skill', c.skills.join(','));
      next.set('cat', c.key);
    }
    setForm({ ...form, skill: c ? c.skills.join(',') : '' });
    setParams(next);
  };
  const goTo = (p) => {
    const next = new URLSearchParams(params);
    next.set('page', p);
    setParams(next);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <div className="mb-8 rounded-2xl bg-brand-50 px-6 py-10 sm:px-10">
        <h1 className="text-3xl font-bold text-ink">{activeCat ? activeCat.name : 'Browse gigs'}</h1>
        <p className="mt-2 text-gray-600">{activeCat ? activeCat.blurb : 'Find work that matches your skills, or see what others need.'}</p>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!activeCat} onClick={() => pickCategory(null)}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={activeCat?.key === c.key} onClick={() => pickCategory(c)}>
            {c.name}
          </Chip>
        ))}
      </div>

      <form onSubmit={apply} className="mb-8 grid gap-3 rounded-xl border border-gray-100 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:grid-cols-12">
        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 sm:col-span-5">
          <Search className="h-4 w-4 text-gray-400" />
          <input className="w-full py-2.5 text-sm outline-none" placeholder="Search gigs" value={form.q} onChange={set('q')} />
        </label>
        <input className="input sm:col-span-2" type="number" min="0" placeholder="Min ₹" value={form.min} onChange={set('min')} />
        <input className="input sm:col-span-2" type="number" min="0" placeholder="Max ₹" value={form.max} onChange={set('max')} />
        <select className="input sm:col-span-2" value={form.sort} onChange={set('sort')}>
          <option value="">Newest</option>
          <option value="budget_high">Highest budget</option>
          <option value="budget_low">Lowest budget</option>
          <option value="deadline">Deadline soonest</option>
        </select>
        <button className="btn-primary sm:col-span-1" title="Apply filters">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </form>

      <ErrorBanner message={error} onRetry={reload} />
      {loading ? (
        <Spinner />
      ) : data?.items?.length ? (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {data.total} gig{data.total === 1 ? '' : 's'} available
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((g) => (
              <GigCard key={g._id} gig={g} />
            ))}
          </div>
          {data.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm">
              <button className="btn-secondary" disabled={page <= 1} onClick={() => goTo(page - 1)}>
                Previous
              </button>
              Page {page} of {data.pages}
              <button className="btn-secondary" disabled={page >= data.pages} onClick={() => goTo(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        !error && <EmptyState title="No gigs found">Try another category or clear your filters.</EmptyState>
      )}
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700'
      }`}
    >
      {children}
    </button>
  );
}
