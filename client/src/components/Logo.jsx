import { Link } from 'react-router-dom';

export default function Logo({ light = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">SG</span>
      <span className={`text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>
        SkillGig<span className="text-brand-500">.</span>
      </span>
    </Link>
  );
}
