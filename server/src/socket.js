import { Server } from 'socket.io';
import { env } from './config/env.js';
import { Gig } from './models/Gig.js';
import { User } from './models/User.js';
import { verifyToken } from './utils/jwt.js';
import { attachRealtime } from './services/realtime.js';
import { canView } from './services/gigAccess.js';

export function setupSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: env.clientUrls } });

  io.use(async (socket, next) => {
    try {
      const { sub } = verifyToken(socket.handshake.auth?.token);
      const user = await User.findById(sub);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(`user:${user._id}`);

    // Subscribe to live updates for a gig page; same visibility rule as the REST API.
    socket.on('gig:join', async (gigId, ack) => {
      try {
        const gig = await Gig.findById(gigId);
        if (!gig || !canView(gig, user)) return ack?.({ ok: false });
        socket.join(`gig:${gig._id}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
    socket.on('gig:leave', (gigId) => socket.leave(`gig:${gigId}`));
  });

  attachRealtime(io);
  return io;
}
