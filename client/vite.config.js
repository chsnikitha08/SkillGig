import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the API runs on :5050 and is proxied, so VITE_API_URL can stay empty.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5050',
      '/socket.io': { target: 'http://localhost:5050', ws: true },
    },
  },
});
