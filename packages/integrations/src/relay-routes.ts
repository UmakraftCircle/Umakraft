import * as http from 'http';
import * as crypto from 'crypto';
import { relayInboxStore } from './relay-inbox.js';
import { createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('Relay-Routes');

/**
 * Sends a message back to a Discord channel on behalf of the phone agent.
 * Injected by the merged process (the discord.js Client).
 */
export type RelaySender = (channelId: string, content: string) => Promise<{ message_id: string }>;

let relaySender: RelaySender | null = null;

/** Set (or clear) the sender used by POST /relay/reply. */
export function setRelaySender(sender: RelaySender | null): void {
  relaySender = sender;
}

/** Timing-safe check that the request carries the scoped RELAY_TOKEN. */
export function checkRelayAuth(req: http.IncomingMessage): boolean {
  const configured = process.env['RELAY_TOKEN'];
  if (!configured) {
    logger.error('RELAY_TOKEN is not configured — relay routes are disabled (401).');
    return false;
  }
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const a = crypto.createHash('sha256').update(configured).digest();
  const b = crypto.createHash('sha256').update(token).digest();
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function corsOrigin(): string {
  const env = process.env['CORS_ORIGIN'];
  if (env) return env;
  return process.env['NODE_ENV'] === 'production' ? '' : '*';
}

function reply(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const MAX_BODY_SIZE = 256 * 1024; // 256 KB — relay replies are small
    let body = '';
    let size = 0;
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Request body read timed out'));
    }, 30_000);
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        clearTimeout(timer);
        reject(new Error('Request body too large'));
        return;
      }
      body += chunk.toString();
    });
    req.on('end', () => {
      clearTimeout(timer);
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Handle a /relay/* request. Returns true if the path was handled (and the
 * response already sent); false otherwise so the caller can fall through.
 */
export async function handleRelay(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  path: string,
  params: Record<string, string>,
): Promise<boolean> {
  if (path !== '/relay/inbox' && path !== '/relay/reply') return false;

  if (!checkRelayAuth(req)) {
    reply(res, 401, { error: 'Unauthorized', message: 'Valid RELAY_TOKEN required.' });
    return true;
  }

  if (path === '/relay/inbox' && req.method === 'GET') {
    const afterSeq = Math.max(parseInt(params['after_seq'] || '0', 10) || 0, 0);
    const limit = Math.min(Math.max(parseInt(params['limit'] || '100', 10) || 100, 1), 500);

    const messages = await relayInboxStore.drain(afterSeq, limit);
    const lastSeq = await relayInboxStore.lastSeq();

    reply(res, 200, { messages, count: messages.length, last_seq: lastSeq });
    return true;
  }

  if (path === '/relay/reply' && req.method === 'POST') {
    let body: any;
    try {
      body = await readBody(req);
    } catch (err: any) {
      reply(res, 400, { ok: false, error: err?.message ?? 'Invalid body' });
      return true;
    }

    const channelId = typeof body.channel_id === 'string' ? body.channel_id.trim() : '';
    const content = typeof body.content === 'string' ? body.content : '';

    if (!channelId) {
      reply(res, 400, { ok: false, error: 'channel_id is required' });
      return true;
    }
    if (!content.trim()) {
      reply(res, 400, { ok: false, error: 'content is required' });
      return true;
    }
    if (content.length > 2000) {
      reply(res, 400, { ok: false, error: 'content exceeds Discord 2000-char limit' });
      return true;
    }
    if (!relaySender) {
      reply(res, 503, { ok: false, error: 'relay sender not wired (bot client unavailable)' });
      return true;
    }

    try {
      const { message_id } = await relaySender(channelId, content);
      reply(res, 200, { ok: true, message_id });
    } catch (err: any) {
      logger.error(`relay reply failed: ${err?.message ?? err}`);
      reply(res, 502, { ok: false, error: err?.message ?? 'Failed to send message' });
    }
    return true;
  }

  // Method not allowed on a known relay path
  reply(res, 405, { error: 'Method Not Allowed', path });
  return true;
}
