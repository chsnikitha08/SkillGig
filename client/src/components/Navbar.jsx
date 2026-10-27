import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { money } from '../utils/format';

const linkCls = ({ isActive }) => `text-sm ${isActive ? 'font-semibold text-indigo-700' : 'text-gray-600 hover:text-gray-900'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="text-lg font-bold text-indigo-700">
          SkillGig
        </Link>
        {user && (
          <>
            <NavLink to="/gigs" end className={linkCls}>
              Browse gigs
            </NavLink>
            {user.role === 'client' && (
              <NavLink to="/gigs/new" className={linkCls}>
                Post a gig
              </NavLink>
            )}
            <NavLink to="/dashboard" className={linkCls}>
              Dashboard
            </NavLink>
            {user.role !== 'admin' && (
              <NavLink to="/wallet" className={linkCls}>
                {user.role === 'client' ? 'Payments' : 'Earnings'}
              </NavLink>
            )}
            {user.role === 'admin' ? (
              <NavLink to="/admin" className={linkCls}>
                Disputes
              </NavLink>
            ) : (
              <NavLink to="/disputes" className={linkCls}>
                Disputes
              </NavLink>
            )}
          </>
        )}
        <div className="ml-auto flex items-center gap-4">
          {user ? (
            <>
              {user.role === 'freelancer' && (
                <Link to="/wallet" className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-medium text-emerald-700" title="Earnings">
                  {money(user.walletBalance)}
                </Link>
              )}
              <NotificationBell />
              <Link to={user.role === 'admin' ? '/admin' : `/users/${user._id}`} className="text-sm text-gray-700">
                {user.name} <span className="text-xs text-gray-400">({user.role})</span>
              </Link>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-900"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkCls}>
                Log in
              </NavLink>
              <Link to="/register" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
