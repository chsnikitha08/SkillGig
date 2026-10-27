import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch';
import GigCard from '../components/GigCard';
import { EmptyState, ErrorBanner, PageTitle, Spinner } from '../components/ui';

const FILTERS = ['q', 'skill', 'min', 'max', 'sort'];

export default function Gigs() {
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(() => Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ''])));
  const { data, loading, error, reload } = useFetch(`/gigs?${params.toString()}`);
  const page = Number(params.get('page') || 1);

  const apply = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    FILTERS.forEach((k) => form[k] && next.set(k, form[k]));
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
      <PageTitle>Browse open gigs</PageTitle>
      <form onSubmit={apply} className="card mb-6 grid gap-3 sm:grid-cols-6">
        <input className="input sm:col-span-2" placeholder="Search title or description" value={form.q} onChange={set('q')} />
        <input className="input" placeholder="Skill, e.g. design" value={form.skill} onChange={set('skill')} />
        <input className="input" type="number" min="0" placeholder="Min ₹" value={form.min} onChange={set('min')} />
        <input className="input" type="number" min="0" placeholder="Max ₹" value={form.max} onChange={set('max')} />
        <select className="input" value={form.sort} onChange={set('sort')}>
          <option value="">Newest</option>
          <option value="budget_high">Budget: high to low</option>
          <option value="budget_low">Budget: low to high</option>
          <option value="deadline">Deadline soonest</option>
        </select>
        <div className="flex gap-2 sm:col-span-6">
          <button className="btn-primary">Search</button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setForm(Object.fromEntries(FILTERS.map((k) => [k, ''])));
              setParams({});
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <ErrorBanner message={error} onRetry={reload} />
      {loading ? (
        <Spinner />
      ) : data?.items?.length ? (
        <>
          <p className="mb-3 text-sm text-gray-500">{data.total} gig{data.total === 1 ? '' : 's'} found</p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.items.map((g) => (
              <GigCard key={g._id} gig={g} />
            ))}
          </div>
          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
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
        !error && <EmptyState title="No gigs match your filters">Try clearing the filters or check back later.</EmptyState>
      )}
    </div>
  );
}
