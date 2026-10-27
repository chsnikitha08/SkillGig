const STYLES = {
  open: 'bg-blue-100 text-blue-800',
  accepted: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-700',
  pending: 'bg-gray-100 text-gray-700',
  funded: 'bg-indigo-100 text-indigo-800',
  submitted: 'bg-amber-100 text-amber-800',
  disputed: 'bg-red-100 text-red-800',
  released: 'bg-emerald-100 text-emerald-800',
  refunded: 'bg-gray-200 text-gray-700',
  split: 'bg-purple-100 text-purple-800',
  rejected: 'bg-gray-200 text-gray-600',
  withdrawn: 'bg-gray-200 text-gray-600',
  resolved: 'bg-emerald-100 text-emerald-800',
};

const LABELS = { in_progress: 'in progress', funded: 'funded · in escrow', accepted: 'awaiting funding' };

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? 'bg-gray-100'}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
