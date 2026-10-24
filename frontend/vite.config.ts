import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Same-origin API calls in development: the browser talks to Vite, Vite forwards to the .NET backend.
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
        '/hubs': { target: 'http://localhost:5000', changeOrigin: true, ws: true },
        '/health': { target: 'http://localhost:5000', changeOrigin: true },
        '/collab': { target: 'http://localhost:1234', changeOrigin: true, ws: true },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
