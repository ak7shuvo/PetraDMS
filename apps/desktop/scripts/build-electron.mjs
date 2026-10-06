// Bundles the Electron main + preload into dist-electron/ as CommonJS.
// Everything except `electron` and Node built-ins (including node:sqlite) is bundled,
// so the installer ships no node_modules and no native addons.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(root, '..');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: false,
  external: ['electron'],
  logLevel: 'info',
  legalComments: 'none'
};

await build({ ...common, entryPoints: [path.join(app, 'electron/main.ts')], outfile: path.join(app, 'dist-electron/main.cjs') });
await build({ ...common, entryPoints: [path.join(app, 'electron/preload.ts')], outfile: path.join(app, 'dist-electron/preload.cjs') });
