import http from 'node:http';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { setupSocket } from './socket.js';
import { startRefundWorker } from './services/paymentService.js';

async function main() {
  await connectDB(env.mongoUri);
  const app = createApp();
  const server = http.createServer(app);
  setupSocket(server);
  startRefundWorker();
  server.listen(env.port, () => console.log(`API listening on port ${env.port}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  console.error(err);
  process.exitCode = 1;
});
