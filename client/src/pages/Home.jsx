import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  ['Post', 'A client posts a gig with a budget, deadline and optional milestones.'],
  ['Hire', 'Freelancers apply with a pitch and a quote. The client accepts one.'],
  ['Fund escrow', 'The client pays via Razorpay; the money is held in escrow. The freelancer sees “Funds secured”.'],
  ['Deliver', 'The freelancer submits each milestone. The client approves or asks for changes.'],
  ['Get paid', 'Approval releases that milestone’s money. Disputes go to an admin.'],
];

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-4xl font-bold text-gray-900">Freelancing for students, where nobody gets cheated.</h1>
      <p className="mt-4 text-lg text-gray-600">
        SkillGig holds the client’s money in escrow until the work is approved. Freelancers know the money exists before they
        start; clients only pay for work they accept. If something goes wrong, an admin decides.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/register" className="btn-primary">
          Create an account
        </Link>
        <Link to="/login" className="btn-secondary">
          Log in
        </Link>
      </div>
      <ol className="mt-10 grid gap-3 sm:grid-cols-2">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="card">
            <p className="text-xs font-semibold uppercase text-indigo-600">Step {i + 1}</p>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-gray-600">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
