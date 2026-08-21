// ── Railway Health Server + Discord Bot Spawner + Phone-Agent Relay ──
// Railway requires a process listening on $PORT to detect
// container readiness. This script starts an HTTP server on $PORT,
// then spawns the Umakraft Discord bot via tsx.
//
// The HTTP server now also serves the phone-agent relay:
//   GET  /health -> 200 ok (Railway probe)
//   GET  /inbox  -> drain shared inbox (Bearer RELAY_TOKEN)
//   POST /reply  -> forward {channel_id, content} to the bot via IPC
//
// CMD: node health.cjs
// ───────────────────────────────────────────────────────────

const http = require('http');
const { spawn } = require('child_process');
const { drainRelayInbox, relayInboxSize } = require('./relay-inbox.cjs');

const PORT = process.env.PORT || 3000;
const RELAY_TOKEN = process.env.RELAY_TOKEN || '';
const PENDING_TIMEOUT_MS = 10000;

function relayAuthorized(req) {
  if (!RELAY_TOKEN) return false;
  const auth = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  return auth === RELAY_TOKEN;
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

// pending /reply requests keyed by requestId (synchronous reply support)
const pendingReplies = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');

  // ── Railway health probe ──
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // ── Phone-agent relay: GET /inbox ──
  if (url.pathname === '/inbox' && req.method === 'GET') {
    if (!relayAuthorized(req)) return json(res, 401, { error: 'unauthorized' });
    const afterId = url.searchParams.get('after_id') || null;
    const messages = drainRelayInbox(afterId);
    return json(res, 200, { messages, count: relayInboxSize() });
  }

  // ── Phone-agent relay: POST /reply (IPC to the bot process) ──
  if (url.pathname === '/reply' && req.method === 'POST') {
    if (!relayAuthorized(req)) return json(res, 401, { error: 'unauthorized' });
    const body = await readBody(req);
    const { channel_id, content } = body || {};
    if (!channel_id || typeof content !== 'string') {
      return json(res, 400, { error: 'channel_id and content are required' });
    }
    if (!bot || !bot.connected || typeof bot.send !== 'function') {
      return json(res, 502, { ok: false, error: 'bot process not running' });
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        pendingReplies.delete(requestId);
        resolve({ ok: false, error: 'reply timed out' });
      }, PENDING_TIMEOUT_MS);
      pendingReplies.set(requestId, (m) => {
        clearTimeout(timer);
        resolve({ ok: m.ok, message_id: m.message_id, error: m.error });
      });
      bot.send({ type: 'relay-reply', channel_id, content, requestId });
    });

    if (result.ok) return json(res, 200, { ok: true, message_id: result.message_id });
    return json(res, 502, { ok: false, error: result.error });
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[health] HTTP server listening on port ${PORT}`);
});

// Spawn the Discord bot via tsx (TypeScript execute).
// The 4th stdio entry ('ipc') creates the IPC channel used for /reply.
const bot = spawn('npx', ['tsx', 'apps/discord/src/index.ts'], {
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
  env: { ...process.env },
});

// Resolve pending /reply requests when the bot echoes a result back.
bot.on('message', (m) => {
  if (m && m.type === 'relay-reply-result') {
    const done = pendingReplies.get(m.requestId);
    if (done) { pendingReplies.delete(m.requestId); done(m); }
    console.log('[health] relay-reply result:', JSON.stringify(m));
  }
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
