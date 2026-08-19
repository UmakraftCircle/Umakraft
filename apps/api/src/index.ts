import * as http from 'http';
import * as crypto from 'crypto';
import { createLogger, PLATFORM_NAME, ExecutionPlan } from '@ai-agent-platform/shared';
import { MockAIService, createProvider } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager, MODELS } from '@ai-agent-platform/core';
import { AuthMiddleware } from './auth.js';

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
    // ── GET / — Interactive Web Dashboard ──
    if (path === '/' && req.method === 'GET') {
      const schemas = toolRegistry.getDeclarativeSchemas();
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>UmaKraft Circle — AI Agent Platform & Bot Manager</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --accent: #38bdf8;
      --accent-glow: rgba(56, 189, 248, 0.15);
      --border: #334155;
      --success: #4ade80;
      --warning: #fbbf24;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(74, 222, 128, 0.1);
      color: var(--success);
      border: 1px solid rgba(74, 222, 128, 0.3);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; display: inline-block; }
    h1 { font-size: 1.75rem; font-weight: 700; color: #fff; }
    p.subtitle { color: var(--text-dim); margin-top: 0.25rem; font-size: 0.95rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .card h3 { font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--accent); display: flex; align-items: center; gap: 0.5rem; }
    .card p { color: var(--text-dim); font-size: 0.9rem; margin-bottom: 0.75rem; }
    .stat { font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0.5rem 0; }
    .btn {
      display: inline-block;
      background: var(--accent);
      color: #0f172a;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      text-decoration: none;
      font-size: 0.875rem;
      transition: opacity 0.2s;
      border: none;
      cursor: pointer;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: #334155; color: #fff; }
    pre {
      background: #090d16;
      padding: 1rem;
      border-radius: 0.5rem;
      font-family: monospace;
      font-size: 0.85rem;
      color: #e2e8f0;
      overflow-x: auto;
      max-height: 250px;
      border: 1px solid var(--border);
    }
    form { display: flex; flex-direction: column; gap: 0.75rem; }
    input[type="text"] {
      background: #090d16;
      border: 1px solid var(--border);
      color: #fff;
      padding: 0.6rem 0.8rem;
      border-radius: 0.5rem;
      font-size: 0.9rem;
    }
    input[type="text"]:focus { outline: none; border-color: var(--accent); }
    .endpoint-tag {
      display: inline-block;
      font-family: monospace;
      background: #090d16;
      color: var(--accent);
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.8rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>UmaKraft Circle — Bot Manager & AI Platform</h1>
        <p class="subtitle">Orchestrator for Discord Automation, Groq AI Agents, Fan Telemetry & Workspace Utilities</p>
      </div>
      <div class="badge"><span class="dot"></span> Platform Active</div>
    </header>

    <div class="grid">
      <div class="card">
        <h3>⚡ API Server Status</h3>
        <p>Core Node.js runtime listening on port ${PORT}</p>
        <div class="stat">Online</div>
        <p>Uptime: <span id="uptime">${Math.floor(process.uptime())}s</span></p>
        <a href="/health" target="_blank" class="btn">View /health JSON</a>
      </div>

      <div class="card">
        <h3>🤖 Registered Tools</h3>
        <p>Discord, Web, File, Fan Telemetry & PR Tools</p>
        <div class="stat">${schemas.length} Tools</div>
        <p>Active modules: AI, Discord, FanTracker, PR-Monitor</p>
        <a href="/tools" target="_blank" class="btn btn-secondary">Explore /tools</a>
      </div>

      <div class="card">
        <h3>🧠 Groq AI & Models</h3>
        <p>Groq Provider & Fallback Mock Service</p>
        <div class="stat">Claude 3.5 / Groq</div>
        <p>Provider: ${process.env['GROQ_API_KEY'] ? 'Groq Active ✅' : 'Mock/Dev Mode ⚡'}</p>
        <a href="/models" target="_blank" class="btn btn-secondary">View /models</a>
      </div>
    </div>

    <div class="card" style="margin-bottom: 1.5rem;">
      <h3>📋 Execute Agent Plan Intent</h3>
      <p>Submit a prompt to test the AI Planner & Task Execution pipeline:</p>
      <form id="planForm">
        <input type="text" id="intentInput" placeholder="e.g. Fetch fan leaderboard and generate daily summary" required />
        <button type="submit" class="btn">Generate Plan</button>
      </form>
      <div id="planResult" style="margin-top: 1rem; display: none;">
        <p style="font-weight: 600; color: #fff; margin-bottom: 0.5rem;">Plan Result:</p>
        <pre id="planOutput"></pre>
      </div>
    </div>

    <div class="card">
      <h3>🌐 Available REST Endpoints</h3>
      <p style="margin-bottom: 1rem;">Directly access system endpoints:</p>
      <ul style="list-style: none; display: flex; flex-direction: column; gap: 0.5rem;">
        <li><span class="endpoint-tag">GET /health</span> — System health, uptime & version</li>
        <li><span class="endpoint-tag">GET /tools</span> — List of all 13 registered platform tools</li>
        <li><span class="endpoint-tag">GET /models</span> — Available AI models</li>
        <li><span class="endpoint-tag">GET /plans</span> — Execution plans history</li>
        <li><span class="endpoint-tag">POST /plans</span> — Submit intent & create execution plan</li>
      </ul>
    </div>
  </div>

  <script>
    document.getElementById('planForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const intent = document.getElementById('intentInput').value;
      const resContainer = document.getElementById('planResult');
      const output = document.getElementById('planOutput');
      resContainer.style.display = 'block';
      output.textContent = 'Generating plan...';
      try {
        const res = await fetch('/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent })
        });
        const data = await res.json();
        output.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        output.textContent = 'Error: ' + err.message;
      }
    });
  </script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // ── Health ──
    if (path === '/health' && req.method === 'GET') {
      jsonResponse(res, 200, {
        status: 'ok',
        platform: PLATFORM_NAME,
        version: process.env['APP_VERSION'] || '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    // ── GET /tools — list all registered tools ──
    if (path === '/tools' && req.method === 'GET') {
      const schemas = toolRegistry.getDeclarativeSchemas();
      jsonResponse(res, 200, { count: schemas.length, tools: schemas });
      return;
    }

    // ── POST /plans — submit a new plan intent ──
    if (path === '/plans' && req.method === 'POST') {
      const body = await readBody(req);
      const intent = body.intent || 'Default agent intent';

      logger.info(`Generating plan for intent: "${intent}"`);
      const plan = await planner.plan(intent);
      planStore.set(plan.id, plan);
      if (authCtx.apiKey) {
        planOwners.set(plan.id, crypto.createHash('sha256').update(authCtx.apiKey).digest('hex'));
      }
      savePlanStore().catch(() => {});

      const planSummary = {
        id: plan.id,
        intent: plan.intent,
        estimatedSteps: plan.tasks.size,
        tasks: Array.from(plan.tasks.values()).map(t => ({
          id: t.id,
          name: t.name,
          toolSlug: t.toolSlug,
          dependencies: t.dependencies
        })),
        metadata: plan.metadata
      };

      jsonResponse(res, 201, planSummary);
      return;
    }

    // ── GET /plans — list all plans (paginated) ──
    if (path === '/plans' && req.method === 'GET') {
      const limit = Math.min(Math.max(parseInt(params['limit'] || '50'), 1), 200);
      const offset = Math.max(parseInt(params['offset'] || '0'), 0);
      const all = Array.from(planStore.values());
      const page = all.slice(offset, offset + limit);
      const plans = page.map(p => ({
        id: p.id,
        intent: p.intent,
        taskCount: p.tasks.size,
        metadata: p.metadata
      }));
      jsonResponse(res, 200, { count: plans.length, total: all.length, limit, offset, plans });
      return;
    }

    // ── GET /plans/:id — get specific plan ──
    const planMatch = path.match(/^\/plans\/(.+)$/);
    if (planMatch && req.method === 'GET') {
      const planId = planMatch[1];
      const plan = planStore.get(planId);

      if (!plan) {
        jsonResponse(res, 404, { error: `Plan not found: ${planId}` });
        return;
      }

      const tasks = Array.from(plan.tasks.values()).map(t => ({
        id: t.id,
        name: t.name,
        toolSlug: t.toolSlug,
        status: t.status,
        dependencies: t.dependencies,
        result: t.result,
        error: t.error,
        retryCount: t.retryCount
      }));

      jsonResponse(res, 200, { id: plan.id, intent: plan.intent, tasks, metadata: plan.metadata });
      return;
    }

    // ── POST /plans/:id/execute — execute a plan (owner-restricted) ──
    const executeMatch = path.match(/^\/plans\/(.+)\/execute$/);
    if (executeMatch && req.method === 'POST') {
      const planId = executeMatch[1];
      const plan = planStore.get(planId);

      if (!plan) {
        jsonResponse(res, 404, { error: `Plan not found: ${planId}` });
        return;
      }

      // Ownership check: only the creator can execute.
      // A plan is owned iff it was created with an API key; execution must then
      // come from the same key. If the plan has an owner but the caller has no
      // (matching) key, reject — closing the gap where auth could be disabled or
      // omitted. Plans created without auth remain unowned and are allowed only
      // in unauthenticated dev deployments.
      const ownerHash = planOwners.get(planId);
      if (ownerHash) {
        if (!authCtx.apiKey) {
          jsonResponse(res, 401, { error: 'Unauthorized: API key required to execute this plan' });
          return;
        }
        const callerHash = crypto.createHash('sha256').update(authCtx.apiKey).digest('hex');
        if (ownerHash !== callerHash) {
          jsonResponse(res, 403, { error: 'Forbidden: you are not the owner of this plan' });
          return;
        }
      }

      logger.info(`Executing plan: ${planId}`);
      const PLAN_EXECUTION_TIMEOUT = 60_000; // 60 seconds
      let timer: ReturnType<typeof setTimeout> | undefined;
      const executedPlan = await Promise.race([
        taskManager.executePlan(plan),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Plan execution timed out after 60 seconds')), PLAN_EXECUTION_TIMEOUT);
        }),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      const results = Array.from(executedPlan.tasks.values()).map(t => ({
        id: t.id,
        name: t.name,
        status: t.status,
        result: t.result,
        error: t.error
      }));

      const succeeded = results.filter(r => r.status === 'completed').length;
      jsonResponse(res, 200, {
        planId,
        totalTasks: results.length,
        succeeded,
        failed: results.length - succeeded,
        tasks: results
      });
      return;
    }

    // ── GET /models — available AI models ──
    if (path === '/models' && req.method === 'GET') {
      jsonResponse(res, 200, { models: Object.values(MODELS) });
      return;
    }

    // ── 404 ──
    jsonResponse(res, 404, { error: 'Not Found', path });
  } catch (error: any) {
    logger.error(`Request handler error: ${error.message}`, error.stack);
    const isDev = process.env['NODE_ENV'] === 'development';
    jsonResponse(res, 500, {
      error: 'Internal Server Error',
      ...(isDev ? { message: error.message } : {}),
    });
  }
});

server.listen(PORT, async () => {
  await loadPlanStore();
  logger.info(`==================================================`);
  logger.info(`${PLATFORM_NAME} API Server listening on http://localhost:${PORT}`);
  logger.info(`Auth:    ${auth.getKeyCount()} key(s) configured`);
  logger.info(`Endpoints:`);
  logger.info(`  GET  /health             — Health check (public)`);
  logger.info(`  GET  /tools              — List registered tools`);
  logger.info(`  POST /plans              — Submit plan intent`);
  logger.info(`  GET  /plans              — List all plans`);
  logger.info(`  GET  /plans/:id          — Get plan details`);
  logger.info(`  POST /plans/:id/execute  — Execute a plan`);
  logger.info(`  GET  /models             — Available AI models`);
  logger.info(`==================================================`);
});

// ── Graceful shutdown ──
const shutdown = () => {
  logger.info('Shutting down API server...');
  server.close(() => {
    auth.destroy();
    logger.info('API server shut down cleanly.');
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
