import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the static build works on any host or sub-path
  // (GitHub Pages, Netlify, Vercel).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
