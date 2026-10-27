import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';
import RoleTabs from '../components/RoleTabs';
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
      localStorage.setItem('skillgig_last_role', form.role);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Join SkillGig to hire students or start earning from your skills.">
      <form onSubmit={submit} className="space-y-5">
        <ErrorBanner message={error} />
        <div>
          <p className="label">I'm joining as a</p>
          <RoleTabs value={form.role} onChange={(role) => setForm({ ...form, role })} />
        </div>
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
        <button className="btn-primary w-full py-3" disabled={pending}>
          {pending ? 'Creating account…' : `Sign up as ${form.role === 'client' ? 'client' : 'freelancer'}`}
        </button>
        <p className="text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="link">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
