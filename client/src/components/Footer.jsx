import { Link } from 'react-router-dom';
import { CATEGORIES, categoryLink } from '../utils/categories';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="mt-20 bg-[#1f2b24] text-gray-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-gray-400">
            The freelance marketplace where payments are protected until the work is approved.
          </p>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">Categories</p>
          <ul className="space-y-2 text-sm">
            {CATEGORIES.slice(0, 5).map((c) => (
              <li key={c.key}>
                <Link to={categoryLink(c)} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">For clients</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/gigs/new" className="hover:text-white">Post a gig</Link></li>
            <li><Link to="/gigs" className="hover:text-white">Browse gigs</Link></li>
            <li><Link to="/register" className="hover:text-white">Create an account</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 font-semibold text-white">For freelancers</p>
          <ul className="space-y-2 text-sm">
            <li><Link to="/gigs" className="hover:text-white">Find work</Link></li>
            <li><Link to="/register" className="hover:text-white">Start earning</Link></li>
            <li><Link to="/dashboard" className="hover:text-white">Dashboard</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-gray-500">© {new Date().getFullYear()} SkillGig. Payments secured by Razorpay.</p>
      </div>
    </footer>
  );
}
