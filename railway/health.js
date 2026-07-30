// ── Railway health-check server ───────────────────────────
// The Discord bot uses outbound WebSocket (no HTTP listener).
// Railway probes $PORT via TCP — this dummy server satisfies it.
// ───────────────────────────────────────────────────────────
const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('UmaKraft Bot — alive');
});

server.listen(PORT, () => {
  console.log(`[health] dummy HTTP server listening on :${PORT}`);
});

// Start the Discord bot as a child process
const bot = spawn('npx', ['tsx', 'apps/discord/src/index.ts'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env },
});

bot.on('exit', (code) => {
  console.error(`[health] bot exited with code ${code}`);
  server.close();
  process.exit(code || 0);
});
