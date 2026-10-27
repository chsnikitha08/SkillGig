import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { EmptyState, ErrorBanner, Field, Spinner } from '../components/ui';
import { date, rating } from '../utils/format';

export default function Profile() {
  const { id } = useParams();
  const { user: me, refreshUser } = useAuth();
  const { data, loading, error, reload } = useFetch(`/users/${id}`);
  const [editing, setEditing] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;
  const { user, reviews } = data;
  const isMe = me._id === user._id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{user.name}</h1>
            <p className="text-sm capitalize text-gray-500">
              {user.role} · joined {date(user.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-amber-600">{rating(user)}</p>
            {user.role === 'freelancer' && <p className="text-sm text-gray-500">{user.completedGigs} gigs completed</p>}
          </div>
        </div>
        {editing ? (
          <EditProfile
            user={user}
            onDone={() => {
              setEditing(false);
              reload();
              refreshUser();
            }}
          />
        ) : (
          <>
            {user.bio && <p className="mt-4 whitespace-pre-line text-gray-700">{user.bio}</p>}
            {user.skills?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {user.skills.map((s) => (
                  <span key={s} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {isMe && (
              <button type="button" className="btn-secondary mt-4" onClick={() => setEditing(true)}>
                Edit profile
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Reviews</h2>
        {!reviews.length ? (
          <EmptyState title="No reviews yet" />
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r._id} className="card text-sm">
                <p>
                  <span className="text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> <b>{r.reviewer.name}</b> on “{r.gig?.title}”
                </p>
                {r.comment && <p className="mt-1 text-gray-700">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EditProfile({ user, onDone }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ name: user.name, bio: user.bio ?? '', skills: (user.skills ?? []).join(', ') });
  const submit = async (e) => {
    e.preventDefault();
    const body = { name: form.name, bio: form.bio };
    if (user.role === 'freelancer') body.skills = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
    if (await run(() => http.patch('/auth/me', body), 'Profile updated')) onDone();
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <Field label="Name">
        <input className="input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Bio">
        <textarea className="input" maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </Field>
      {user.role === 'freelancer' && (
        <Field label="Skills" hint="Comma separated">
          <input className="input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
        </Field>
      )}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          Save
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
