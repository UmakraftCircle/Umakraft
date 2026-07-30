// ── Railway health-check server ───────────────────────────
// The Discord bot uses outbound WebSocket (no HTTP listener).
// Railway probes $PORT via TCP — this dummy server satisfies it.
// ───────────────────────────────────────────────────────────
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('UmaKraft Bot — alive');
});

server.listen(PORT, () => {
  console.log(`[health] dummy HTTP server listening on :${PORT}`);
});

// Start the Discord bot — use the installed tsx binary, not npx
const tsxBin = path.join(__dirname, 'node_modules', '.bin', 'tsx');
const bot = spawn(tsxBin, ['apps/discord/src/index.ts'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env },
});

bot.on('exit', (code, signal) => {
  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.error(`[health] bot exited with ${reason}`);
  server.close();
  // null code (killed by signal) → exit 1 so Railway restarts
  // non-zero code → pass through
  process.exit(code ?? 1);
});
