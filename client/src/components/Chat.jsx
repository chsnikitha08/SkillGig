import { useCallback, useEffect, useRef, useState } from 'react';
import { http } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../hooks/useAction';
import { useFetch } from '../hooks/useFetch';
import { useGigRoom } from '../hooks/useGigRoom';
import { ErrorBanner, Spinner } from './ui';
import { dateTime } from '../utils/format';

export default function Chat({ gigId, readOnly }) {
  const { user } = useAuth();
  const { data, loading, error, reload, setData } = useFetch(`/gigs/${gigId}/messages`);
  const { run, pending } = useAction();
  const [text, setText] = useState('');
  const bottom = useRef(null);

  // Messages arrive over the socket for everyone, including the sender; de-duplicate by id.
  const onMessage = useCallback(
    (msg) => {
      if (msg.gig !== gigId) return;
      setData((d) => (d?.messages.some((m) => m._id === msg._id) ? d : { messages: [...(d?.messages ?? []), msg] }));
    },
    [gigId, setData],
  );
  useGigRoom(gigId, { onMessage });

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [data]);

  const send = async (e) => {
    e.preventDefault();
    const res = await run(() => http.post(`/gigs/${gigId}/messages`, { text }));
    if (res) {
      setText('');
      onMessage(res.data.message);
    }
  };

  return (
    <div>
      <ErrorBanner message={error} onRetry={reload} />
      {loading ? (
        <Spinner />
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md bg-gray-50 p-3">
          {!data?.messages?.length && <p className="text-sm text-gray-500">No messages yet. Say hello!</p>}
          {data?.messages?.map((m) => {
            const mine = m.sender._id === user._id;
            return (
              <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-gray-200'}`}>
                  {!mine && (
                    <p className="text-xs font-semibold">
                      {m.sender.name}
                      {m.sender.role === 'admin' && ' (admin)'}
                    </p>
                  )}
                  <p className="whitespace-pre-line break-words">
                    <Linkified text={m.text} mine={mine} />
                  </p>
                  <p className={`mt-1 text-[10px] ${mine ? 'text-brand-200' : 'text-gray-400'}`}>{dateTime(m.createdAt)}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottom} />
        </div>
      )}
      {!readOnly && (
        <form onSubmit={send} className="mt-2 flex gap-2">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" maxLength={2000} />
          <button className="btn-primary" disabled={pending || !text.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

/** Turns http(s) links in a message into clickable links; everything else stays plain text. */
function Linkified({ text, mine }) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener" className={`underline ${mine ? 'text-white' : 'text-brand-700'}`}>
        {part}
      </a>
    ) : (
      part
    ),
  );
}
