import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, http } from '../api/http';
import { useToast } from '../context/ToastContext';
import { ErrorBanner, Field, PageTitle } from '../components/ui';
import { money } from '../utils/format';

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function PostGig() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ title: '', description: '', skills: '', budget: '', deadline: tomorrow() });
  const [useMilestones, setUseMilestones] = useState(false);
  const [milestones, setMilestones] = useState([{ title: '', amount: '' }]);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const msTotal = milestones.reduce((s, m) => s + (Number(m.amount) || 0), 0);
  const budget = Number(form.budget) || 0;
  const updateMs = (i, k, v) => setMilestones(milestones.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  const submit = async (e) => {
    e.preventDefault();
    if (useMilestones && msTotal !== budget) {
      setError(`Stages add up to ${money(msTotal)} but the budget is ${money(budget)}`);
      return;
    }
    setPending(true);
    setError('');
    try {
      const { data } = await http.post('/gigs', {
        title: form.title,
        description: form.description,
        skillsRequired: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        budget,
        // End of the chosen day, in the user's timezone.
        deadline: new Date(`${form.deadline}T23:59:00`).toISOString(),
        milestones: useMilestones ? milestones.map((m) => ({ title: m.title, amount: Number(m.amount) })) : undefined,
      });
      toast('Gig posted. Freelancers can now apply.');
      navigate(`/gigs/${data.gig._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>Post a gig</PageTitle>
      <form onSubmit={submit} className="card space-y-4">
        <ErrorBanner message={error} />
        <Field label="Title">
          <input className="input" required minLength={5} maxLength={120} value={form.title} onChange={set('title')} placeholder="e.g. Logo for our coding club" />
        </Field>
        <Field label="Description" hint="What do you need, what format, any references? At least 20 characters.">
          <textarea className="input min-h-32" required minLength={20} value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Skills needed" hint="Comma separated">
          <input className="input" value={form.skills} onChange={set('skills')} placeholder="design, figma" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget (₹)">
            <input className="input" type="number" min="1" step="1" required value={form.budget} onChange={set('budget')} />
          </Field>
          <Field label="Deadline">
            <input className="input" type="date" min={tomorrow()} required value={form.deadline} onChange={set('deadline')} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useMilestones} onChange={(e) => setUseMilestones(e.target.checked)} />
          Pay in stages (approve and pay for each part separately)
        </label>
        {useMilestones && (
          <div className="space-y-2 rounded-md bg-gray-50 p-3">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className="input" required placeholder={`Stage ${i + 1}, e.g. First draft`} value={m.title} onChange={(e) => updateMs(i, 'title', e.target.value)} />
                <input className="input w-32" required type="number" min="1" placeholder="₹" value={m.amount} onChange={(e) => updateMs(i, 'amount', e.target.value)} />
                <button type="button" className="btn-secondary" disabled={milestones.length === 1} onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="link" disabled={milestones.length >= 10} onClick={() => setMilestones([...milestones, { title: '', amount: '' }])}>
                + Add stage
              </button>
              <span className={msTotal === budget ? 'text-emerald-700' : 'text-red-600'}>
                Total {money(msTotal)} / budget {money(budget)}
              </span>
            </div>
          </div>
        )}
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Posting…' : 'Post gig'}
        </button>
      </form>
    </div>
  );
}
