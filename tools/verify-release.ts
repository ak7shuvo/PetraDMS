// Release-only checks. Phase 1 baseline: confirms the installer builds. Extended in Phase 12.
import { spawnSync } from 'node:child_process';

const r = spawnSync('pnpm', ['--filter', '@petra/desktop', 'dist:dir'], { stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
