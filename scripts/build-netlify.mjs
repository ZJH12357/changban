import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)),
  'build', '--webpack',
], {
  cwd: root,
  env: { ...process.env, CHANGBAN_BACKEND: 'netlify', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
