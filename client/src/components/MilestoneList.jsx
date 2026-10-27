import { useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAction } from '../hooks/useAction';
import StatusBadge from './StatusBadge';
import { money } from '../utils/format';

/** One row per milestone, with the actions the current user is allowed to take. */
export default function MilestoneList({ gig, role, isClient, isFreelancer, disputes, onChanged }) {
  return (
    <ol className="space-y-3">
      {gig.milestones.map((m, i) => (
        <Milestone
          key={m._id}
          index={i}
          m={m}
          gig={gig}
          role={role}
          isClient={isClient}
          isFreelancer={isFreelancer}
          dispute={disputes?.find((d) => d.milestoneId === m._id && d.status === 'open')}
          onChanged={onChanged}
        />
      ))}
    </ol>
  );
}

function Milestone({ m, index, gig, isClient, isFreelancer, dispute, onChanged }) {
  const { run, pending } = useAction();
  const [mode, setMode] = useState(null); // 'submit' | 'revision' | 'dispute'
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const base = `/gigs/${gig._id}/milestones/${m._id}`;
  const active = gig.status === 'in_progress';
  const deadlinePassed = new Date(gig.deadline) < new Date();

  const act = async (fn, msg) => {
    const ok = await run(fn, msg);
    if (ok) {
      setMode(null);
      setText('');
      setLink('');
      onChanged();
    }
  };

  const forms = {
    submit: {
      title: 'Submit your work',
      placeholder: 'What are you delivering? Any notes for the client?',
      button: 'Submit work',
      call: () => http.post(`${base}/submit`, { note: text, link }),
      msg: 'Work submitted. The client has been notified.',
    },
    revision: {
      title: 'Request changes',
      placeholder: 'What should be changed?',
      button: 'Send revision request',
      call: () => http.post(`${base}/revision`, { note: text }),
      msg: 'Revision requested',
    },
    dispute: {
      title: 'Raise a dispute',
      placeholder: 'Explain what went wrong (at least 20 characters). An admin will review both sides and the chat.',
      button: 'Raise dispute',
      call: () => http.post(`${base}/dispute`, { reason: text }),
      msg: 'Dispute raised. An admin will review it.',
    },
  };
  const form = mode && forms[mode];

  return (
    <li className="rounded-md border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {index + 1}. {m.title}
        </p>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{money(m.amount)}</span>
          <StatusBadge status={m.status} />
        </div>
      </div>

      {m.revisionNote && m.status === 'funded' && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Changes requested ({m.revisionCount}/3): {m.revisionNote}
        </p>
      )}
      {(m.submissionNote || m.submissionLink) && m.status !== 'funded' && (
        <div className="mt-2 rounded bg-gray-50 px-3 py-2 text-sm">
          <p className="text-gray-700">{m.submissionNote}</p>
          {m.submissionLink && (
            <a href={m.submissionLink} target="_blank" rel="noreferrer noopener" className="link break-all">
              {m.submissionLink}
            </a>
          )}
        </div>
      )}
      {['released', 'refunded', 'split'].includes(m.status) && (
        <p className="mt-2 text-sm text-gray-600">
          {money(m.releasedAmount)} paid to freelancer{m.refundedAmount > 0 && `, ${money(m.refundedAmount)} refunded to client`}
        </p>
      )}
      {m.status === 'disputed' && dispute && (
        <p className="mt-2 text-sm">
          Under review by an admin. <Link className="link" to={`/disputes/${dispute._id}`}>View dispute</Link>
        </p>
      )}

      {active && !form && (
        <div className="mt-3 flex flex-wrap gap-2">
          {isFreelancer && m.status === 'funded' && (
            <button type="button" className="btn-primary" onClick={() => setMode('submit')}>
              Submit work
            </button>
          )}
          {isClient && m.status === 'submitted' && (
            <>
              <button
                type="button"
                className="btn-success"
                disabled={pending}
                onClick={() =>
                  window.confirm(`Release ${money(m.amount)} to the freelancer? This cannot be undone.`) &&
                  act(() => http.post(`${base}/approve`), `${money(m.amount)} released to the freelancer`)
                }
              >
                {pending ? 'Releasing…' : `Approve & release ${money(m.amount)}`}
              </button>
              <button type="button" className="btn-secondary" disabled={m.revisionCount >= 3} onClick={() => setMode('revision')}>
                Request changes
              </button>
            </>
          )}
          {m.status === 'submitted' && (isClient || isFreelancer) && (
            <button type="button" className="btn-secondary text-red-700" onClick={() => setMode('dispute')}>
              Raise dispute
            </button>
          )}
          {isClient && m.status === 'funded' && deadlinePassed && (
            <button type="button" className="btn-secondary text-red-700" onClick={() => setMode('dispute')}>
              Not delivered? Raise dispute
            </button>
          )}
          {isFreelancer && m.status === 'submitted' && <span className="self-center text-sm text-gray-500">Waiting for the client to review.</span>}
        </div>
      )}

      {form && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            act(form.call, form.msg);
          }}
        >
          <p className="text-sm font-medium">{form.title}</p>
          <textarea className="input min-h-20" required value={text} onChange={(e) => setText(e.target.value)} placeholder={form.placeholder} />
          {mode === 'submit' && (
            <input className="input" type="url" placeholder="Link to the work (Drive, GitHub, Figma…), optional" value={link} onChange={(e) => setLink(e.target.value)} />
          )}
          <div className="flex gap-2">
            <button className={mode === 'dispute' ? 'btn-danger' : 'btn-primary'} disabled={pending}>
              {pending ? 'Sending…' : form.button}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}
