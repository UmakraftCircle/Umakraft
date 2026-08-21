// ── Railway Process Supervisor ──────────────────────────────
// Spawns the merged Umakraft process (Discord gateway + HTTP relay/health)
// via tsx. The merged process itself listens on $PORT and answers /health,
// so Railway's readiness probe hits the real app, not a dummy server.
//
// CMD: node health.cjs
// ─────────────────────────────────────────────────────────────

const { spawn } = require('child_process');

// Spawn the merged bot+relay process via tsx (TypeScript execute).
const app = spawn('npx', ['tsx', 'apps/discord/src/merged.ts'], {
  stdio: 'inherit',
  env: { ...process.env },
});

app.on('close', (code) => {
  console.error(`[health] Merged process exited with code ${code}`);
  process.exit(code ?? 1);
});

app.on('error', (err) => {
  console.error(`[health] Failed to start merged process: ${err.message}`);
  process.exit(1);
});

// Forward signals to the merged process.
process.on('SIGTERM', () => {
  console.log('[health] SIGTERM received, shutting down...');
  app.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('[health] SIGINT received, shutting down...');
  app.kill('SIGINT');
});
