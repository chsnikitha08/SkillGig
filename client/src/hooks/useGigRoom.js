import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/** Joins the live room for a gig: refetch when it changes, and receive chat messages. */
export function useGigRoom(gigId, { onUpdate, onMessage }) {
  const { socket } = useAuth();
  useEffect(() => {
    if (!socket || !gigId) return undefined;
    const join = () => socket.emit('gig:join', gigId);
    join();
    socket.on('connect', join); // rejoin after reconnects
    const updated = (p) => p.gigId === gigId && onUpdate?.();
    socket.on('gig:updated', updated);
    if (onMessage) socket.on('chat:message', onMessage);
    return () => {
      socket.emit('gig:leave', gigId);
      socket.off('connect', join);
      socket.off('gig:updated', updated);
      if (onMessage) socket.off('chat:message', onMessage);
    };
  }, [socket, gigId, onUpdate, onMessage]);
}
