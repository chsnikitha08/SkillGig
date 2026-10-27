import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { useGigRoom } from '../hooks/useGigRoom';
import Applications from '../components/Applications';
import Chat from '../components/Chat';
import MilestoneList from '../components/MilestoneList';
import StatusBadge from '../components/StatusBadge';
import { ErrorBanner, Field, Spinner } from '../components/ui';
import { date, money, rating, timeLeft } from '../utils/format';
import { payForGig } from '../utils/razorpay';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../api/http';

export default function GigDetail() {
  const { id } = useParams();
  const { user, refreshUser } = useAuth();
  const { data, loading, error, reload } = useFetch(`/gigs/${id}`);

  // Another party changed the gig (funded, submitted, approved…): refetch quietly.
  const onUpdate = useCallback(() => {
    reload({ silent: true });
    refreshUser().catch(() => {});
  }, [reload, refreshUser]);
  useGigRoom(id, { onUpdate });

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const { gig, myApplication, reviews = [], disputes = [] } = data;
  const isClient = gig.client._id === user._id;
  const isFreelancer = gig.freelancer?._id === user._id;
  const changed = () => onUpdate();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{gig.title}</h1>
              <p className="mt-1 text-sm text-gray-500">
                Posted by <Link className="link" to={`/users/${gig.client._id}`}>{gig.client.name}</Link> · Due {date(gig.deadline)} (
                {timeLeft(gig.deadline)})
              </p>
            </div>
            <StatusBadge status={gig.status} />
          </div>
          <p className="mt-4 whitespace-pre-line text-gray-700">{gig.description}</p>
          <div className="mt-4 flex flex-wrap gap-1">
            {gig.skillsRequired.map((s) => (
              <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {s}
              </span>
            ))}
          </div>
        </section>

        <NextStep gig={gig} isClient={isClient} isFreelancer={isFreelancer} onChanged={changed} />

        <section className="card">
          <h2 className="mb-3 font-semibold">Milestones</h2>
          <MilestoneList gig={gig} isClient={isClient} isFreelancer={isFreelancer} disputes={disputes} onChanged={changed} />
        </section>

        {isClient && ['open', 'accepted'].includes(gig.status) && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Applicants ({gig.applicationCount})</h2>
            <Applications gig={gig} onChanged={changed} />
          </section>
        )}

        {user.role === 'freelancer' && gig.status === 'open' && <ApplyBox gig={gig} application={myApplication} onChanged={changed} />}

        {gig.status === 'completed' && (isClient || isFreelancer) && (
          <Reviews gig={gig} reviews={reviews} user={user} onChanged={changed} />
        )}
      </div>

      <aside className="space-y-6">
        <section className="card text-sm">
          <h2 className="mb-3 font-semibold">Summary</h2>
          <dl className="space-y-2">
            <Row label="Budget" value={money(gig.budget)} />
            {gig.agreedAmount && <Row label="Agreed price" value={money(gig.agreedAmount)} />}
            <Row label="In escrow now" value={money(gig.escrowHeld)} />
            <Row label="Client" value={<>{gig.client.name} <span className="text-gray-400">{rating(gig.client)}</span></>} />
            {gig.freelancer && (
              <Row
                label="Freelancer"
                value={
                  <Link className="link" to={`/users/${gig.freelancer._id}`}>
                    {gig.freelancer.name}
                  </Link>
                }
              />
            )}
          </dl>
        </section>
        {gig.freelancer && (isClient || isFreelancer || user.role === 'admin') && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Chat</h2>
            <Chat gigId={gig._id} readOnly={gig.status === 'cancelled'} />
          </section>
        )}
      </aside>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** A banner that tells each party what happens next, with the action to take. */
function NextStep({ gig, isClient, isFreelancer, onChanged }) {
  const { run, pending } = useAction();
  const toast = useToast();
  const [paying, setPaying] = useState(false);

  const pay = async () => {
    setPaying(true);
    try {
      const res = await payForGig(gig._id);
      if (res.cancelled) toast('Payment cancelled. Nothing was charged.', 'error');
      else if (res.gig?.status === 'in_progress') toast(`Payment verified. ${money(gig.agreedAmount)} is now held in escrow.`);
      else toast('Payment not confirmed yet. Use "Check payment status" in a moment.', 'error');
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
      onChanged();
    } finally {
      setPaying(false);
    }
  };
  const sync = async () => {
    const res = await run(() => http.post(`/gigs/${gig._id}/fund/sync`));
    if (res) {
      toast(res.data.gig?.status === 'in_progress' ? 'Payment found and verified.' : 'No completed payment found for this gig yet.', res.data.found === false ? 'error' : 'success');
      onChanged();
    }
  };
  const cancel = async () => {
    if (!window.confirm('Cancel this gig? Applicants will be notified.')) return;
    const res = await run(() => http.post(`/gigs/${gig._id}/cancel`), 'Gig cancelled');
    if (res) onChanged();
  };

  let tone = 'bg-gray-50 border-gray-200 text-gray-700';
  let body = null;

  if (gig.status === 'open' && isClient) body = 'Waiting for applications. Review applicants below and hire one.';
  if (gig.status === 'accepted' && isClient) {
    tone = 'bg-amber-50 border-amber-200 text-amber-900';
    body = (
      <>
        <p>
          Pay <b>{money(gig.agreedAmount)}</b> into escrow so {gig.freelancer.name} can start. SkillGig holds it and releases each milestone only
          when you approve it.
        </p>
        <p className="mt-1 text-xs">Secure checkout by Razorpay (test mode: card 4386 2894 0766 0153, any future expiry, any CVV, or UPI success@razorpay).</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={paying || pending} onClick={pay}>
            {paying ? 'Processing payment…' : `Pay ${money(gig.agreedAmount)} with Razorpay`}
          </button>
          <button type="button" className="link text-sm" disabled={pending || paying} onClick={sync}>
            Already paid? Check payment status
          </button>
        </div>
      </>
    );
  }
  if (gig.status === 'accepted' && isFreelancer) {
    tone = 'bg-amber-50 border-amber-200 text-amber-900';
    body = 'You were hired! Wait until the client pays into escrow before starting work.';
  }
  if (gig.status === 'in_progress' && isFreelancer) {
    tone = 'bg-emerald-50 border-emerald-200 text-emerald-900';
    body = `✓ Funds secured: ${money(gig.escrowHeld)} is locked in escrow for you. Submit each milestone when ready.`;
  }
  if (gig.status === 'in_progress' && isClient) {
    tone = 'bg-indigo-50 border-indigo-200 text-indigo-900';
    body = `${money(gig.escrowHeld)} is held in escrow. Approve submitted milestones to release payment.`;
  }
  if (gig.status === 'completed') {
    tone = 'bg-emerald-50 border-emerald-200 text-emerald-900';
    body = 'This gig is complete and every milestone is settled.';
  }
  if (gig.status === 'cancelled') body = 'This gig was cancelled. Any payment made for it is refunded automatically.';

  const canCancel = isClient && ['open', 'accepted'].includes(gig.status);
  if (!body && !canCancel) return null;
  return (
    <section className={`rounded-lg border p-4 ${tone}`}>
      {typeof body === 'string' ? <p>{body}</p> : body}
      {canCancel && (
        <button type="button" className="btn-secondary mt-3" disabled={pending || paying} onClick={cancel}>
          Cancel gig
        </button>
      )}
    </section>
  );
}

function ApplyBox({ gig, application, onChanged }) {
  const { run, pending } = useAction();
  const [pitch, setPitch] = useState('');
  const [quote, setQuote] = useState(String(gig.budget));

  if (application) {
    const withdraw = async () => {
      const res = await run(() => http.post(`/applications/${application._id}/withdraw`), 'Application withdrawn');
      if (res) onChanged();
    };
    return (
      <section className="card">
        <h2 className="mb-2 font-semibold">Your application</h2>
        <p className="text-sm">
          Quoted {money(application.quotedPrice)} · <StatusBadge status={application.status} />
        </p>
        <p className="mt-2 whitespace-pre-line text-sm text-gray-700">{application.pitch}</p>
        {application.status === 'pending' && (
          <button type="button" className="btn-secondary mt-3" disabled={pending} onClick={withdraw}>
            Withdraw
          </button>
        )}
      </section>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => http.post(`/gigs/${gig._id}/apply`, { pitch, quotedPrice: Number(quote) }), 'Application sent');
    if (res) onChanged();
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">Apply for this gig</h2>
      <Field label="Your pitch" hint="Why you? Mention similar work. At least 20 characters.">
        <textarea className="input min-h-24" required minLength={20} value={pitch} onChange={(e) => setPitch(e.target.value)} />
      </Field>
      <Field label="Your price (₹)" hint={gig.milestones.length > 1 ? 'Milestone amounts will be scaled to your price if accepted.' : undefined}>
        <input className="input w-40" type="number" min={gig.milestones.length} required value={quote} onChange={(e) => setQuote(e.target.value)} />
      </Field>
      <button className="btn-primary" disabled={pending}>
        {pending ? 'Sending…' : 'Send application'}
      </button>
    </form>
  );
}

function Reviews({ gig, reviews, user, onChanged }) {
  const { run, pending } = useAction();
  const [ratingValue, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const mine = reviews.find((r) => r.reviewer._id === user._id);

  const submit = async (e) => {
    e.preventDefault();
    const res = await run(() => http.post(`/gigs/${gig._id}/review`, { rating: ratingValue, comment }), 'Thanks for your review!');
    if (res) onChanged();
  };

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Reviews</h2>
      {reviews.map((r) => (
        <div key={r._id} className="text-sm">
          <p>
            <b>{r.reviewer.name}</b> <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
          </p>
          {r.comment && <p className="text-gray-700">{r.comment}</p>}
        </div>
      ))}
      {!mine && (
        <form onSubmit={submit} className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm font-medium">Rate the {gig.client._id === user._id ? 'freelancer' : 'client'}</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className={`text-2xl ${n <= ratingValue ? 'text-amber-500' : 'text-gray-300'}`} aria-label={`${n} stars`}>
                ★
              </button>
            ))}
          </div>
          <textarea className="input" placeholder="Optional comment" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          <button className="btn-primary" disabled={pending}>
            Submit review
          </button>
        </form>
      )}
    </section>
  );
}
