import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { EmptyState, ErrorBanner, PageTitle, Spinner } from '../components/ui';
import { dateTime, money } from '../utils/format';

const TYPE = {
  topup: ['Top-up', 'text-emerald-700'],
  fund: ['Moved to escrow', 'text-red-700'],
  release: ['Payment received', 'text-emerald-700'],
  refund: ['Refund from escrow', 'text-emerald-700'],
};

export default function Wallet() {
  const { user, refreshUser } = useAuth();
  const [page, setPage] = useState(1);
  const wallet = useFetch('/wallet');
  const txs = useFetch(`/wallet/transactions?page=${page}`);
  const { run, pending } = useAction();
  const [amount, setAmount] = useState('1000');
  // One key per intended top-up, so a double click or retry can't add money twice.
  const idemKey = useRef(crypto.randomUUID());

  const topUp = async (e) => {
    e.preventDefault();
    const res = await run(
      () => http.post('/wallet/topup', { amount: Number(amount) }, { headers: { 'Idempotency-Key': idemKey.current } }),
      `${money(amount)} test credits added`,
    );
    if (res) {
      idemKey.current = crypto.randomUUID();
      refreshUser();
      wallet.reload({ silent: true });
      txs.reload({ silent: true });
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle>Wallet</PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-2xl font-semibold">{money(user.walletBalance)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">{user.role === 'client' ? 'Locked in escrow' : 'Coming to you (in escrow)'}</p>
          <p className="text-2xl font-semibold">{wallet.loading ? '…' : money(wallet.data?.inEscrow)}</p>
        </div>
        <form onSubmit={topUp} className="card">
          <p className="mb-2 text-sm text-gray-500">Add test credits</p>
          <div className="flex gap-2">
            <input className="input" type="number" min="1" max="50000" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn-primary" disabled={pending}>
              Add
            </button>
          </div>
        </form>
      </div>
      <p className="text-xs text-gray-500">
        SkillGig uses simulated test credits. No real money is involved; escrow holds and releases are recorded in the app’s own ledger.
      </p>

      <section>
        <h2 className="mb-2 font-semibold">Ledger</h2>
        <ErrorBanner message={txs.error} onRetry={txs.reload} />
        {txs.loading ? (
          <Spinner />
        ) : !txs.data?.items.length ? (
          <EmptyState title="No transactions yet">Top up your wallet to get started.</EmptyState>
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
                  const [label, cls] = TYPE[t.type];
                  const outgoing = t.fromUser === user._id;
                  return (
                    <tr key={t._id}>
                      <td className="px-4 py-2 text-gray-500">{dateTime(t.createdAt)}</td>
                      <td className="px-4 py-2">{label}</td>
                      <td className="px-4 py-2">{t.gig ? <Link className="link" to={`/gigs/${t.gig._id}`}>{t.gig.title}</Link> : '—'}</td>
                      <td className={`px-4 py-2 text-right font-medium ${cls}`}>
                        {outgoing ? '−' : '+'}
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
