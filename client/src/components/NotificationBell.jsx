import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useFetch } from '../hooks/useFetch';
import { dateTime } from '../utils/format';

export default function NotificationBell({ light = false }) {
  const { socket, refreshUser } = useAuth();
  const toast = useToast();
  const { data, setData } = useFetch('/notifications');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Live notifications: prepend, bump the counter, show a toast, and refresh the
  // wallet balance in case money moved.
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (n) => {
      setData((d) => ({ items: [n, ...(d?.items ?? [])].slice(0, 30), unread: (d?.unread ?? 0) + 1 }));
      if (n.type !== 'chat_message') toast(n.message);
      refreshUser().catch(() => {});
    };
    socket.on('notification', onNew);
    return () => socket.off('notification', onNew);
  }, [socket, setData, toast, refreshUser]);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = async () => {
    setOpen((o) => !o);
    if (!open && data?.unread) {
      setData((d) => ({ ...d, unread: 0 }));
      http.post('/notifications/read').catch(() => {});
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className={`relative rounded-lg p-2 ${light ? 'text-white/90 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {data?.unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{data.unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border text-ink border-gray-200 bg-white shadow-lg">
          {!data?.items?.length ? (
            <p className="p-4 text-sm text-gray-500">No notifications yet.</p>
          ) : (
            data.items.map((n) => (
              <Link
                key={n._id}
                to={n.gig ? `/gigs/${n.gig}` : '#'}
                onClick={() => setOpen(false)}
                className={`block border-b border-gray-100 px-4 py-3 text-sm hover:bg-gray-50 ${n.read ? 'text-gray-600' : 'font-medium text-gray-900'}`}
              >
                {n.message}
                <span className="mt-1 block text-xs font-normal text-gray-400">{dateTime(n.createdAt)}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
