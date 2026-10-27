import { LogOut } from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { money } from '../utils/format';

/** On the home page the bar sits transparently over the hero photo. */
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const overlay = pathname === '/';

  const linkCls = ({ isActive }) =>
    `text-sm font-medium transition ${
      overlay ? (isActive ? 'text-white' : 'text-white/80 hover:text-white') : isActive ? 'text-brand-700' : 'text-gray-600 hover:text-ink'
    }`;

  const links = [['/gigs', 'Browse gigs']];
  if (user?.role === 'client') links.push(['/gigs/new', 'Post a gig']);
  if (user) links.push(['/dashboard', 'Dashboard']);
  if (user?.role === 'client') links.push(['/wallet', 'Payments']);
  if (user?.role === 'freelancer') links.push(['/wallet', 'Earnings']);
  if (user) links.push([user.role === 'admin' ? '/admin' : '/disputes', 'Disputes']);

  return (
    <header className={overlay ? 'absolute inset-x-0 top-0 z-30' : 'sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur'}>
      <nav className="container-page flex h-16 items-center gap-8">
        <Logo light={overlay} />
        <div className="hidden items-center gap-6 md:flex">
          {links.map(([to, label]) => (
            <NavLink key={label} to={to} end={to === '/gigs'} className={linkCls}>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {user.role === 'freelancer' && (
                <Link
                  to="/wallet"
                  className={`hidden rounded-lg px-2.5 py-1 text-sm font-semibold sm:inline ${overlay ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700'}`}
                  title="Earnings"
                >
                  {money(user.walletBalance)}
                </Link>
              )}
              <NotificationBell light={overlay} />
              <Link
                to={user.role === 'admin' ? '/admin' : `/users/${user._id}`}
                className={`flex items-center gap-2 text-sm font-medium ${overlay ? 'text-white' : 'text-ink'}`}
              >
                <Avatar name={user.name} />
                <span className="hidden lg:inline">{user.name}</span>
              </Link>
              <button
                type="button"
                title="Log out"
                className={`rounded-lg p-2 ${overlay ? 'text-white/80 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              {/* The filled button follows the page: "Log in" on the login page, "Sign up" everywhere else. */}
              {[
                ['/login', 'Log in'],
                ['/register', 'Sign up'],
              ].map(([to, label]) => {
                const highlighted = pathname === '/login' ? to === '/login' : to === '/register';
                const cls = highlighted ? (overlay ? 'btn-secondary border-white py-2' : 'btn-dark py-2') : linkCls({ isActive: false });
                return (
                  <Link key={to} to={to} className={cls}>
                    {label}
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
