import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { EmptyState, ErrorBanner, PageTitle, Spinner } from '../components/ui';
import { dateTime, money } from '../utils/format';

const TYPE = {
  client: {
    fund: ['Paid into escrow (Razorpay)', 'text-gray-900', '−'],
    refund: ['Refund to your payment method', 'text-emerald-700', '+'],
  },
  freelancer: {
    release: ['Payment released to you', 'text-emerald-700', '+'],
  },
};

const REFUND_STATUS = {
  processed: 'text-emerald-700',
  pending: 'text-amber-700',
  processing: 'text-amber-700',
  failed: 'text-red-700',
};

/** Clients see their Razorpay payments and refunds; freelancers see their earnings. */
export default function Wallet() {
  const { user } = useAuth();
  const isClient = user.role === 'client';
  const [page, setPage] = useState(1);
  const summary = useFetch('/wallet');
  const txs = useFetch(`/wallet/transactions?page=${page}`);

  const tiles = isClient
    ? [
        ['Paid via Razorpay', summary.data?.paid],
        ['Held in escrow', summary.data?.inEscrow],
        ['Refunded', summary.data?.refunded],
        ['Refunds in progress', summary.data?.pendingRefunds],
      ]
    : [
        ['Earnings', summary.data?.earnings],
        ['Coming to you (in escrow)', summary.data?.inEscrow],
      ];

  return (
    <div className="space-y-6">
      <PageTitle>{isClient ? 'Payments' : 'Earnings'}</PageTitle>
      <ErrorBanner message={summary.error} onRetry={summary.reload} />
      <div className={`grid gap-4 ${isClient ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
        {tiles.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-semibold">{summary.loading ? '…' : money(value)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {isClient
          ? 'Escrow is paid through Razorpay (test mode). Refunds from cancelled gigs and dispute decisions go back to the original payment method.'
          : 'Released payments are recorded here. Bank payouts are not enabled yet (they require a RazorpayX business account).'}
      </p>

      <section>
        <h2 className="mb-2 font-semibold">History</h2>
        <ErrorBanner message={txs.error} onRetry={txs.reload} />
        {txs.loading ? (
          <Spinner />
        ) : !txs.data?.items.length ? (
          <EmptyState title="Nothing here yet">
            {isClient ? 'Hire a freelancer and pay into escrow to get started.' : 'Payments appear here when clients approve your work.'}
          </EmptyState>
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Gig</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txs.data.items.map((t) => {
                  const [label, cls, sign] = TYPE[user.role]?.[t.type] ?? [t.type, '', ''];
                  return (
                    <tr key={t._id}>
                      <td className="px-4 py-2 text-gray-500">{dateTime(t.createdAt)}</td>
                      <td className="px-4 py-2">
                        {label}
                        {t.refund && (
                          <span className={`ml-2 text-xs font-medium ${REFUND_STATUS[t.refund.status]}`}>
                            {t.refund.status}
                            {t.refund.lastError && ` · ${t.refund.lastError}`}
                          </span>
                        )}
                        {t.type === 'fund' && <span className="block text-xs text-gray-400">{t.note}</span>}
                        {t.refund?.razorpayRefundId && <span className="block text-xs text-gray-400">{t.refund.razorpayRefundId}</span>}
                      </td>
                      <td className="px-4 py-2">{t.gig ? <Link className="link" to={`/gigs/${t.gig._id}`}>{t.gig.title}</Link> : '—'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${cls}`}>
                        {sign}
                        {money(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {txs.data?.pages > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3 text-sm">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            Page {page} of {txs.data.pages}
            <button className="btn-secondary" disabled={page >= txs.data.pages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
