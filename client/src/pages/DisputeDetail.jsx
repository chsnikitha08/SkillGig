import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import Chat from '../components/Chat';
import StatusBadge from '../components/StatusBadge';
import { ErrorBanner, Field, Spinner } from '../components/ui';
import { dateTime, money, rating } from '../utils/format';

export default function DisputeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/disputes/${id}`);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  const { dispute, gig, milestone } = data;
  const canRespond = dispute.status === 'open' && !dispute.response && dispute.against._id === user._id;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold">Dispute: {milestone.title}</h1>
              <p className="text-sm text-gray-500">
                On <Link className="link" to={`/gigs/${gig._id}`}>{gig.title}</Link> · {money(dispute.amount)} on hold
              </p>
            </div>
            <StatusBadge status={dispute.status} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Statement title={`${dispute.raisedBy.name} (${dispute.raisedBy.role}) says`} text={dispute.reason} />
            <Statement title={`${dispute.against.name} (${dispute.against.role}) says`} text={dispute.response || 'No response yet.'} muted={!dispute.response} />
          </div>
        </section>

        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Submitted work</h2>
          {milestone.submissionNote || milestone.submissionLink ? (
            <>
              <p className="whitespace-pre-line">{milestone.submissionNote}</p>
              {milestone.submissionLink && (
                <a className="link break-all" href={milestone.submissionLink} target="_blank" rel="noreferrer noopener">
                  {milestone.submissionLink}
                </a>
              )}
              {milestone.submittedAt && <p className="mt-1 text-xs text-gray-500">Submitted {dateTime(milestone.submittedAt)}</p>}
            </>
          ) : (
            <p className="text-gray-500">No work was submitted for this stage.</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Revisions requested: {milestone.revisionCount} · Gig deadline {dateTime(gig.deadline)}
          </p>
        </section>

        {canRespond && <RespondForm id={dispute._id} onDone={reload} />}
        {dispute.status === 'resolved' && <Decision dispute={dispute} />}
        {user.role === 'admin' && dispute.status === 'open' && <ResolveForm dispute={dispute} onDone={reload} />}
      </div>

      <aside className="space-y-6">
        <section className="card text-sm">
          <h2 className="mb-2 font-semibold">Parties</h2>
          <p>
            Client: {gig.client.name} <span className="text-gray-400">{rating(gig.client)}</span>
          </p>
          <p>
            Freelancer: {gig.freelancer.name} <span className="text-gray-400">{rating(gig.freelancer)} · {gig.freelancer.completedGigs} done</span>
          </p>
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Gig chat</h2>
          <Chat gigId={gig._id} />
        </section>
      </aside>
    </div>
  );
}

function Statement({ title, text, muted }) {
  return (
    <div className="rounded-md bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
      <p className={`mt-1 whitespace-pre-line text-sm ${muted ? 'italic text-gray-400' : ''}`}>{text}</p>
    </div>
  );
}

function Decision({ dispute }) {
  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
      <p className="font-semibold">
        Resolved by {dispute.resolvedBy?.name ?? 'admin'}: {dispute.decision}
      </p>
      <p>
        {money(dispute.freelancerAmount)} to freelancer · {money(dispute.clientAmount)} refunded to the client
      </p>
      <p className="mt-2 whitespace-pre-line">{dispute.adminNote}</p>
    </section>
  );
}

function RespondForm({ id, onDone }) {
  const { run, pending } = useAction();
  const [text, setText] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (await run(() => http.post(`/disputes/${id}/respond`, { response: text }), 'Your response was added')) onDone();
  };
  return (
    <form onSubmit={submit} className="card space-y-2">
      <h2 className="font-semibold">Add your side</h2>
      <textarea className="input min-h-24" required minLength={10} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary" disabled={pending}>
        Submit response
      </button>
    </form>
  );
}

function ResolveForm({ dispute, onDone }) {
  const { run, pending } = useAction();
  const [decision, setDecision] = useState('release');
  const [share, setShare] = useState(String(Math.floor(dispute.amount / 2)));
  const [note, setNote] = useState('');
  const toFreelancer = decision === 'release' ? dispute.amount : decision === 'refund' ? 0 : Number(share) || 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Pay ${money(toFreelancer)} to the freelancer and refund ${money(dispute.amount - toFreelancer)} to the client?`)) return;
    const body = { decision, note, ...(decision === 'split' && { freelancerAmount: Number(share) }) };
    if (await run(() => http.post(`/disputes/${dispute._id}/resolve`, body), 'Decision saved. Both parties have been notified.')) onDone();
  };

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">Resolve dispute</h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          ['release', 'Release to freelancer'],
          ['refund', 'Refund client'],
          ['split', 'Split'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setDecision(value)}
            className={`rounded-md border px-3 py-2 text-sm ${decision === value ? 'border-brand-600 bg-brand-50 font-medium text-brand-700' : 'border-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {decision === 'split' && (
        <Field label={`Freelancer's share (₹1 – ₹${dispute.amount - 1})`}>
          <input className="input w-40" type="number" min="1" max={dispute.amount - 1} required value={share} onChange={(e) => setShare(e.target.value)} />
        </Field>
      )}
      <p className="text-sm text-gray-600">
        Freelancer gets <b>{money(toFreelancer)}</b>, client gets back <b>{money(dispute.amount - toFreelancer)}</b> as a refund to their original payment method.
      </p>
      <Field label="Decision note" hint="Shown to both parties. At least 10 characters.">
        <textarea className="input" required minLength={10} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button className="btn-primary" disabled={pending}>
        {pending ? 'Saving…' : 'Confirm decision'}
      </button>
    </form>
  );
}
