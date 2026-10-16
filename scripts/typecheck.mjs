import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Vinext and Next.js both generate .next/types. Regenerate Next's declarations
// before checking so switching build targets cannot leave an incompatible cache.
for (const args of [
  [fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)), 'typegen'],
  [fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)), '--noEmit', '--incremental', 'false'],
]) {
  const result = spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true,cwd:fileURLToPath(new URL('../',import.meta.url))});
  if(result.error) throw result.error;
  if(result.status!==0) process.exit(result.status??1);
}
