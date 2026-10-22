// Bundles packages/shared (plus zod and the data JSON) into one ES module the Supabase
// Edge Function can import: supabase/functions/_shared/game.js.
import { build } from 'esbuild';

await build({
  entryPoints: ['packages/shared/src/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  outfile: 'supabase/functions/_shared/game.js',
  logLevel: 'info',
});
