import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, Field } from '../components/ui';

const DEMO = [
  ['Client (Rahul)', 'rahul@skillgig.dev'],
  ['Freelancer (Priya)', 'priya@skillgig.dev'],
  ['Freelancer (Arjun)', 'arjun@skillgig.dev'],
  ['Admin', 'admin@skillgig.dev'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-6 text-2xl font-semibold">Log in</h1>
      <form onSubmit={submit} className="card space-y-4">
        <ErrorBanner message={error} />
        <Field label="Email">
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-center text-sm text-gray-600">
          New here? <Link to="/register" className="link">Create an account</Link>
        </p>
      </form>
      <div className="card mt-4">
        <p className="mb-2 text-sm font-medium text-gray-700">Demo accounts (password: demo1234)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map(([label, email]) => (
            <button key={email} type="button" className="btn-secondary text-xs" onClick={() => setForm({ email, password: 'demo1234' })}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
