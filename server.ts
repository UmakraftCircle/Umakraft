import { existsSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const apiDist = join(__dirname, 'apps/api/dist/index.js');

if (process.env.PORT === '8080') {
  process.env.PORT = '3000';
}

// If compiled distribution file does not exist, build it now
if (!existsSync(apiDist)) {
  try {
    console.log('[Startup] Building project artifacts with npm run build...');
    execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('[Startup] Failed to build:', err);
  }
}

if (existsSync(apiDist)) {
  await import('./apps/api/dist/index.js');
} else {
  const isTsxActive = process.execArgv.some(arg => arg.includes('tsx')) || process.env.TSX_ACTIVE === '1';

  if (!isTsxActive) {
    const scriptPath = fileURLToPath(import.meta.url);
    const child = spawn(process.execPath, ['--import', 'tsx', scriptPath, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, TSX_ACTIVE: '1' }
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });

    const forwardSignal = (sig: NodeJS.Signals) => {
      if (child.pid) child.kill(sig);
    };
    process.on('SIGINT', () => forwardSignal('SIGINT'));
    process.on('SIGTERM', () => forwardSignal('SIGTERM'));
  } else {
    await import('./apps/api/src/index.ts');
  }
}


