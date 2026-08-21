import * as http from 'http';
import * as crypto from 'crypto';
import { createLogger, PLATFORM_NAME, ExecutionPlan } from '@ai-agent-platform/shared';
import { MockAIService, createProvider } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager, MODELS } from '@ai-agent-platform/core';
import { AuthMiddleware } from './auth.js';
import { handleRelay } from './relay-routes.js';

// Register all platform tools
import { allTools, webTools, notificationTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';

const logger = createLogger('API-Server');
const PORT = 3000;

// Bootstrap tool registry
for (const tool of [...allTools, ...webTools, ...notificationTools]) {
  toolRegistry.register(tool);
}
for (const integration of allIntegrations) {
  toolRegistry.register(integration);
}
for (const domainTool of [...fanTrackerTools, ...prMonitorTools]) {
  toolRegistry.register(domainTool);
}

logger.info(`Registered ${toolRegistry.getDeclarativeSchemas().length} tools in API server.`);

// Core services — use real provider when keys are set, fall back to mock in dev only
const aiService = (() => {
  const groqKey = process.env['GROQ_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (groqKey) return createProvider('groq', groqKey);
  if (openaiKey) return createProvider('openai', openaiKey);
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('No AI API key configured for production. Set GROQ_API_KEY or OPENAI_API_KEY.');
  }
  logger.warn('No AI keys found — using MockAIService (static responses). NOT for production.');
  return new MockAIService('claude-3-5-sonnet');
})();
const planner = new Planner(aiService, toolRegistry);
const taskManager = new TaskManager(toolRegistry);

// Plan store with owner tracking + file-based persistence for restart survival (audit #10)
const PLAN_STORE_FILE = process.env['PLAN_STORE_FILE'] || '.cache/plan-store.json';
const planStore = new Map<string, ExecutionPlan>();
const planOwners = new Map<string, string>();

async function loadPlanStore(): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const raw = await fs.readFile(PLAN_STORE_FILE, 'utf-8');
    const entries: Array<[string, any]> = JSON.parse(raw);
    for (const [id, planData] of entries) {
      const tasks = new Map(planData.tasks as Array<[string, any]>);
      planStore.set(id, { ...planData, tasks });
    }
    logger.info(`Loaded ${planStore.size} plans from ${PLAN_STORE_FILE}`);
  } catch {
    // First run or file missing
  }
}

async function savePlanStore(): Promise<void> {
  try {
    const fs = await import('node:fs/promises');
    const pathMod = await import('node:path');
    await fs.mkdir(pathMod.dirname(PLAN_STORE_FILE), { recursive: true });
    const entries = [...planStore.entries()].map(([id, plan]) => [
      id,
      { ...plan, tasks: [...plan.tasks.entries()] },
    ]);
    await fs.writeFile(PLAN_STORE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err: any) {
    logger.warn(`Failed to persist plan store: ${err.message}`);
  }
}

// ── CORS helper ──
function corsOrigin(): string {
  const env = process.env['CORS_ORIGIN'];
  if (env) return env;
  // In production, do NOT reflect a wildcard origin. Reflecting '*' permits any
  // origin to make credentialed/cross-origin requests against the API. Default
  // to a lock-down value when no explicit CORS_ORIGIN is configured.
  return process.env['NODE_ENV'] === 'production' ? '' : '*';
}

// ── JSON helpers ──

function jsonResponse(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
    let body = '';
    let size = 0;

    // Safety timeout — abort if client stalls
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Request body read timed out after 30 seconds'));
    }, 30_000);

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        clearTimeout(timer);
        reject(new Error(`Request body exceeds ${MAX_BODY_SIZE / 1024 / 1024}MB limit`));
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

function parseUrl(req: http.IncomingMessage): { path: string; params: Record<string, string> } {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const params: Record<string, string> = {};
  for (const [k, v] of url.searchParams) {
    params[k] = v;
  }
  return { path: url.pathname, params };
}

// ── Router ──

// ── Auth middleware ──
const auth = new AuthMiddleware({
  requireAuth: !!(process.env['API_KEY'] || process.env['API_KEYS']), // only require auth if keys are configured
  publicPaths: ['/health'],
});

logger.info(`Auth: ${auth.getKeyCount()} API key(s) configured. Auth required: ${!!(process.env['API_KEY'] || process.env['API_KEYS'])}`);

// ── Server ──

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 204, null);
    return;
  }

  const { path, params } = parseUrl(req);

  logger.info(`${req.method} ${path}`);

  // ── Auth middleware ──
  const authCtx = await auth.handle(req, res);
  if (!authCtx) return; // response already sent by middleware

  try {
    // ── Relay routes (scoped RELAY_TOKEN auth) — before other routes ──
    if (await handleRelay(req, res, path, params)) {
      return;
    }

    // ── GET / — Interactive Web Dashboard ──