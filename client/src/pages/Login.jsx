import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import { ErrorBanner, Field } from '../components/ui';

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
    <AuthLayout title="Welcome back" subtitle="Log in to manage your gigs, payments and messages.">
      <form onSubmit={submit} className="space-y-5">
        <ErrorBanner message={error} />
        <Field label="Email">
          <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <button className="btn-primary w-full py-3" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-center text-sm text-gray-600">
          New to SkillGig? <Link to="/register" className="link">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
