import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const apiDist = join(__dirname, 'apps/api/dist/index.js');
const sharedDist = join(__dirname, 'packages/shared/dist/index.js');

if (!existsSync(apiDist) || !existsSync(sharedDist)) {
  console.log('[Server] Dist files not found. Building project with tsc -b --force...');
  execSync('npx tsc -b --force', { stdio: 'inherit' });
}

try {
  await import('./apps/api/dist/index.js');
} catch (error) {
  console.error('[Server] Fatal error importing API server bundle:', error);
  process.exit(1);
}
