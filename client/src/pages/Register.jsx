import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, Field } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client', skills: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const skills = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
      await register({ ...form, skills });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <form onSubmit={submit} className="card space-y-4">
        <ErrorBanner message={error} />
        <fieldset>
          <legend className="label">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['client', 'Hire students'],
              ['freelancer', 'Find work'],
            ].map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => setForm({ ...form, role })}
                className={`rounded-md border px-3 py-2 text-sm ${form.role === role ? 'border-indigo-600 bg-indigo-50 font-medium text-indigo-700' : 'border-gray-300'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Name">
          <input className="input" required minLength={2} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input className="input" type="password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        {form.role === 'freelancer' && (
          <Field label="Skills" hint="Comma separated, e.g. design, react, video">
            <input className="input" value={form.skills} onChange={set('skills')} />
          </Field>
        )}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="link">Log in</Link>
        </p>
      </form>
    </div>
  );
}
