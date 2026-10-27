import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  ['Post a gig', 'Describe the work, set a budget and deadline, and split it into stages if you like.'],
  ['Hire', 'Students apply with a pitch and a price. Compare ratings and pick the best fit.'],
  ['Pay securely', 'Pay through Razorpay. SkillGig holds the money safely, so the freelancer knows it’s there.'],
  ['Review the work', 'Approve each stage when you’re happy, or ask for changes.'],
  ['Everyone’s protected', 'Freelancers get paid on approval. If something goes wrong, our team steps in.'],
];

export default function Home() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  return (
    <div className="mx-auto max-w-3xl py-10">
      <h1 className="text-4xl font-bold text-gray-900">Freelancing for students, where nobody gets cheated.</h1>
      <p className="mt-4 text-lg text-gray-600">
        Hire talented students for logos, notes, websites and videos. Your payment is held safely until you approve the work,
        so freelancers know they’ll be paid and clients only pay for work they’re happy with.
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
