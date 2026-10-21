import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the static build works on any host or sub-path
  // (GitHub Pages, Netlify, Vercel).
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  // A fixed port keeps the save: localStorage belongs to one address, and Vite would
  // otherwise move to 5174+ (a fresh, empty game) whenever 5173 is taken.
  server: { host: true, port: 5173, strictPort: true },
});
