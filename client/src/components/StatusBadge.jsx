const STYLES = {
  open: 'bg-blue-100 text-blue-800',
  accepted: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-brand-100 text-brand-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-700',
  pending: 'bg-gray-100 text-gray-700',
  funded: 'bg-brand-100 text-brand-800',
  submitted: 'bg-amber-100 text-amber-800',
  disputed: 'bg-red-100 text-red-800',
  released: 'bg-emerald-100 text-emerald-800',
  refunded: 'bg-gray-200 text-gray-700',
  split: 'bg-purple-100 text-purple-800',
  rejected: 'bg-gray-200 text-gray-600',
  withdrawn: 'bg-gray-200 text-gray-600',
  resolved: 'bg-emerald-100 text-emerald-800',
};

const LABELS = {
  open: 'Open',
  accepted: 'Awaiting payment',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Not started',
  funded: 'In progress',
  submitted: 'Awaiting review',
  disputed: 'Under review',
  released: 'Paid',
  refunded: 'Refunded',
  split: 'Settled',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
  resolved: 'Resolved',
};

// Applications reuse some status words ("accepted") with a different meaning.
const APPLICATION_LABELS = { pending: 'Pending', accepted: 'Hired', rejected: 'Not selected', withdrawn: 'Withdrawn' };
const APPLICATION_STYLES = { accepted: 'bg-emerald-100 text-emerald-800' };

export default function StatusBadge({ status, kind }) {
  if (kind === 'application') {
    return (
      <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${APPLICATION_STYLES[status] ?? STYLES[status] ?? 'bg-gray-100'}`}>
        {APPLICATION_LABELS[status] ?? status}
      </span>
    );
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-gray-100'}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
