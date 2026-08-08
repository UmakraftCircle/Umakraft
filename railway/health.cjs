// ── Railway Health Server + Discord Bot Spawner ────────────
// Railway requires a process listening on $PORT to detect
// container readiness. This script starts a dummy HTTP server
// on $PORT, then spawns the Umakraft Discord bot via tsx.
//
// CMD: node health.cjs
// ───────────────────────────────────────────────────────────

const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

// Create a minimal HTTP server that responds 200 to Railway's health probes
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[health] HTTP server listening on port ${PORT}`);
});

// Spawn the Discord bot via tsx (TypeScript execute)
const bot = spawn('npx', ['tsx', 'apps/discord/src/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env },
});

bot.on('close', (code) => {
  console.error(`[health] Bot process exited with code ${code}`);
  process.exit(code ?? 1);
});

bot.on('error', (err) => {
  console.error(`[health] Failed to start bot: ${err.message}`);
  process.exit(1);
});

// Forward signals to bot process
process.on('SIGTERM', () => {
  console.log('[health] SIGTERM received, shutting down...');
  bot.kill('SIGTERM');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[health] SIGINT received, shutting down...');
  bot.kill('SIGINT');
  server.close(() => process.exit(0));
});
