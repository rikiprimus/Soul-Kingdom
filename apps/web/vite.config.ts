import { existsSync } from 'fs';
import { resolve } from 'path';
import { defineConfig, type Connect, type Plugin } from 'vite';

/** Pages, one folder each, so their addresses carry no ".html" (/berita, /monster, ...). */
const pages = {
  main: 'index.html',
  berita: 'berita/index.html',
  artikel: 'artikel/index.html',
  peringkat: 'peringkat/index.html',
  monster: 'monster/index.html',
  admin: 'admin/index.html',
};

/**
 * Clean addresses on the dev and preview servers, as the host does in production
 * (public/_redirects, vercel.json): /berita serves berita/index.html, and /berita/<slug>
 * serves the article page.
 */
function cleanUrls(root: string): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const [path = '', query = ''] = (req.url ?? '').split(/(?=\?)/);
    if (/^\/berita\/[^/.]+\/?$/.test(path)) {
      req.url = `/artikel/${query}`;
    } else if (/^\/[a-z-]+$/.test(path) && existsSync(resolve(root, `.${path}/index.html`))) {
      req.url = `${path}/${query}`;
    }
    next();
  };
  return {
    name: 'clean-urls',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  base: '/',
  plugins: [cleanUrls(__dirname)],
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(pages).map(([name, file]) => [name, resolve(__dirname, file)]),
      ),
    },
  },
});
