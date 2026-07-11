import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Puerto fijo 5191 (strictPort): es el que Spinup registra y sondea.
// /api se proxya al backend en 5192.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5191,
    strictPort: true,
    // Permite servir a traves de un tunel de Cloudflare (acceso desde el celular).
    allowedHosts: ['.trycloudflare.com', '.cfargotunnel.com'],
    proxy: {
      '/api': 'http://127.0.0.1:5192',
      '/auth': 'http://127.0.0.1:5192',
    },
  },
});
