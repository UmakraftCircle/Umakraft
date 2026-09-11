import * as http from 'http';
import * as crypto from 'crypto';
import { access, readFile as readFileAsync } from 'node:fs/promises';
import { createLogger, PLATFORM_NAME, ExecutionPlan } from '@ai-agent-platform/shared';
import { MockAIService, createProvider } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager, MODELS } from '@ai-agent-platform/core';
import { AuthMiddleware } from './auth.js';

// Register all platform tools
import { allTools, webTools, notificationTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';
import {
  HealthCollector,
  HealthAnalyzer,
  FileAdapter,
  createHealthEvent,
  validateHealthEvent,
  validateHealthMetric,
  collectCIHealth,
  collectDependencyHealth,
  collectDeploymentHealth,
} from '@ai-agent-platform/health';
import { PHASE1_FINDINGS_TEXT } from './phase1-report.js';
import { PHASE2_FINDINGS_TEXT } from './phase2-report.js';
import { PHASE3_FINDINGS_TEXT } from './phase3-report.js';
import { PHASE4_FINDINGS_TEXT } from './phase4-report.js';
import { PHASE5_FINDINGS_TEXT } from './phase5-report.js';
import { PHASE6_FINDINGS_TEXT } from './phase6-report.js';

const logger = createLogger('API-Server');
const PORT = 3000;
const healthCollector = new HealthCollector();
const healthAnalyzer = new HealthAnalyzer(healthCollector);
const healthStorage = new FileAdapter();
const healthStreamClients = new Set<http.ServerResponse>();
healthCollector.registerService({ name: 'api', version: process.env['APP_VERSION'] || '1.0.0' });
healthCollector.on('event', (event) => {
  const payload = `event: health\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of healthStreamClients) {
    try { client.write(payload); } catch { healthStreamClients.delete(client); }
  }
});
healthCollector.on('metric', (metric) => {
  const payload = `event: metric\ndata: ${JSON.stringify(metric)}\n\n`;
  for (const client of healthStreamClients) {
    try { client.write(payload); } catch { healthStreamClients.delete(client); }
  }
});
const persistHealth = () => healthStorage.save(healthCollector.exportState()).catch((error) => {
  logger.warn(`Failed to persist health state: ${error.message}`);
});

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
  const groqKey = process.env['GROQ_API_KEYS'] || process.env['GROQ_API_KEY'];
  const openaiKey = process.env['OPENAI_API_KEY'];
  if (groqKey) return createProvider('groq', groqKey);
  if (openaiKey) return createProvider('openai', openaiKey);
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('No AI API key configured for production. Set GROQ_API_KEYS, GROQ_API_KEY or OPENAI_API_KEY.');
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
const planTelemetryStore = new Map<string, any>();

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
  publicPaths: ['/', '/health', '/health/status', '/health/stream', '/tools', '/models'],
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
    // ── GET/HEAD / — Interactive Web Dashboard ──
    if (path === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
      const schemas = toolRegistry.getDeclarativeSchemas();
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Umakraft Circle — AI Agent Platform & Bot Manager</title>
  <meta name="description" content="AI Agent Platform & Bot Manager for orchestrating intelligent workflows, Discord automation, and UmaKraft fan telemetry" />
  <meta property="og:title" content="Umakraft Circle — AI Agent Platform & Bot Manager" />
  <meta property="og:description" content="AI Agent Platform & Bot Manager for orchestrating intelligent workflows, Discord automation, and UmaKraft fan telemetry" />
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
        <p>Provider: ${process.env['GROQ_API_KEYS'] || process.env['GROQ_API_KEY'] ? 'Groq Active ✅' : 'Mock/Dev Mode ⚡'}</p>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <p style="font-weight: 600; color: #fff; margin: 0;">Plan Result:</p>
          <button id="executeBtn" class="btn" style="display: none; background: #22c55e; color: #0f172a;">⚡ Execute Plan & Collect Telemetry</button>
        </div>
        <pre id="planOutput"></pre>
      </div>

      <div id="telemetryResult" style="margin-top: 1.5rem; display: none; border-top: 1px solid var(--border); padding-top: 1rem;">
        <h4 style="color: var(--accent); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          📊 Phase 10: Execution Telemetry & Diagnostics
        </h4>
        <div id="telemetryCards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;"></div>
        <pre id="telemetryOutput" style="max-height: 280px;"></pre>
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
        <li><span class="endpoint-tag">POST /plans/:id/execute</span> — Execute plan with automatic telemetry</li>
        <li><span class="endpoint-tag">GET /plans/:id/telemetry</span> — Trace spans & diagnostics for execution</li>
        <li><span class="endpoint-tag">GET /telemetry</span> — Latest execution telemetry & historical plans</li>
        <li><span class="endpoint-tag">GET /phase1-findings</span> — Phase 1 architecture audit findings in plain text</li>
        <li><span class="endpoint-tag">GET /phase2-findings</span> — Phase 2 DM to /chat integration findings in plain text</li>
        <li><span class="endpoint-tag">GET /phase3-findings</span> — Phase 3 DM intent router (ask.ts vs chat.ts) findings in plain text</li>
        <li><span class="endpoint-tag">GET /phase4-findings</span> — Phase 4 shared user memory & DM personalization findings in plain text</li>
        <li><span class="endpoint-tag">GET /phase5-findings</span> — Phase 5 conversation memory & context management findings in plain text</li>
        <li><span class="endpoint-tag">GET /phase6-findings</span> — Phase 6 long-term memory & persistence findings in plain text</li>
      </ul>
    </div>

    <div class="card" style="margin-top: 1.5rem; border-color: #8b5cf6;" id="phase6Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0; color: #8b5cf6;">💾 Phase 6: Long-Term Memory & Persistence</h3>
        <button id="copyPhase6Btn" class="btn" style="background: #8b5cf6; color: #ffffff; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon6">📋</span> <span id="copyBtnText6">Copy Phase 6 Findings</span>
        </button>
      </div>
      <p>Memory service abstraction (MemoryService / PersistentMemoryService), durable Turso LibSQL persistence surviving bot restarts, user ID partitioning, context limit enforcement (MAX_MESSAGES = 20), and long-term user profile facts integration.</p>
      <pre id="phase6FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>

    <div class="card" style="margin-top: 1.5rem; border-color: #f59e0b;" id="phase5Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0; color: #f59e0b;">💬 Phase 5: Conversation Memory & Context Management</h3>
        <button id="copyPhase5Btn" class="btn" style="background: #f59e0b; color: #0f172a; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon5">📋</span> <span id="copyBtnText5">Copy Phase 5 Findings</span>
        </button>
      </div>
      <p>Isolated conversation store keyed by Discord user ID (Map&lt;string, ChatMessage[]&gt;), sliding window history limit (MAX_MESSAGES = 20), multi-turn contextual prompt injection in DMs, assistant reply recording, and automated test suite verification.</p>
      <pre id="phase5FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>

    <div class="card" style="margin-top: 1.5rem; border-color: #10b981;" id="phase4Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0; color: #10b981;">🧠 Phase 4: Shared User Memory & Persistent DM Personalization</h3>
        <button id="copyPhase4Btn" class="btn" style="background: #10b981; color: #0f172a; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon4">📋</span> <span id="copyBtnText4">Copy Phase 4 Findings</span>
        </button>
      </div>
      <p>Shared user profile (preferredName, timezone, interests, projects, preferences, goals), long-term memory extraction, deterministic importance scoring, cross-command memory sharing across /ask and /chat, and conversation summaries.</p>
      <pre id="phase4FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>

    <div class="card" style="margin-top: 1.5rem; border-color: #a855f7;" id="phase3Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0; color: #a855f7;">🤖 Phase 3: DM Intent Router (Automatic Routing to ask.ts vs chat.ts)</h3>
        <button id="copyPhase3Btn" class="btn" style="background: #a855f7; color: #ffffff; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon3">📋</span> <span id="copyBtnText3">Copy Phase 3 Findings</span>
        </button>
      </div>
      <p>Architecture map of ask.ts vs chat.ts, zero-keyword AI classifier implementation (classifyIntent), prompt design, safe chat fallbacks, generateAskResponse extraction, and automated test suite verification.</p>
      <pre id="phase3FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>

    <div class="card" style="margin-top: 1.5rem; border-color: #38bdf8;" id="phase2Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0; color: #38bdf8;">✨ Phase 2: Direct Messages Connected to /chat System</h3>
        <button id="copyPhase2Btn" class="btn" style="background: #38bdf8; color: #0f172a; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon2">📋</span> <span id="copyBtnText2">Copy Phase 2 Findings</span>
        </button>
      </div>
      <p>Investigation report, execution path trace, shared generateChatResponse architecture, stable DM sessions (discord-dm:\${userId}), memory persistence, and test verification.</p>
      <pre id="phase2FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>

    <div class="card" style="margin-top: 1.5rem;" id="phase1Card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
        <h3 style="margin-bottom: 0;">💬 Phase 1: Discord DM Foundation Findings</h3>
        <button id="copyPhase1Btn" class="btn" style="background: var(--accent); color: #0f172a; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
          <span id="copyIcon">📋</span> <span id="copyBtnText">Copy Phase 1 Findings</span>
        </button>
      </div>
      <p>Audit results, Discord architecture findings, file changes, and safety verification for Phase 1 DM implementation.</p>
      <pre id="phase1FindingsText" style="max-height: 380px; white-space: pre-wrap; word-break: break-word; user-select: all; font-size: 0.82rem;"></pre>
    </div>
  </div>

  <script>
    let currentPlanId = null;

    const phase1FindingsData = ${JSON.stringify(PHASE1_FINDINGS_TEXT)};
    const findingsEl = document.getElementById('phase1FindingsText');
    if (findingsEl) {
      findingsEl.textContent = phase1FindingsData;
    }

    const phase2FindingsData = ${JSON.stringify(PHASE2_FINDINGS_TEXT)};
    const findingsEl2 = document.getElementById('phase2FindingsText');
    if (findingsEl2) {
      findingsEl2.textContent = phase2FindingsData;
    }

    const phase3FindingsData = ${JSON.stringify(PHASE3_FINDINGS_TEXT)};
    const findingsEl3 = document.getElementById('phase3FindingsText');
    if (findingsEl3) {
      findingsEl3.textContent = phase3FindingsData;
    }

    const phase4FindingsData = ${JSON.stringify(PHASE4_FINDINGS_TEXT)};
    const findingsEl4 = document.getElementById('phase4FindingsText');
    if (findingsEl4) {
      findingsEl4.textContent = phase4FindingsData;
    }

    const phase5FindingsData = ${JSON.stringify(PHASE5_FINDINGS_TEXT)};
    const findingsEl5 = document.getElementById('phase5FindingsText');
    if (findingsEl5) {
      findingsEl5.textContent = phase5FindingsData;
    }

    const phase6FindingsData = ${JSON.stringify(PHASE6_FINDINGS_TEXT)};
    const findingsEl6 = document.getElementById('phase6FindingsText');
    if (findingsEl6) {
      findingsEl6.textContent = phase6FindingsData;
    }

    function setupCopyButton(btnId, textId, iconId, textData, defaultLabel) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', async () => {
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(textData);
            copied = true;
          } catch (e) {}
        }
        if (!copied) {
          const ta = document.createElement('textarea');
          ta.value = textData;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); copied = true; } catch (e) {}
          document.body.removeChild(ta);
        }

        const copyBtnText = document.getElementById(textId);
        const copyIcon = document.getElementById(iconId);
        if (copyBtnText) copyBtnText.textContent = copied ? 'Copied to Clipboard!' : 'Select text in box below';
        if (copyIcon && copied) copyIcon.textContent = '✅';
        setTimeout(() => {
          if (copyBtnText) copyBtnText.textContent = defaultLabel;
          if (copyIcon) copyIcon.textContent = '📋';
        }, 2500);
      });
    }

    setupCopyButton('copyPhase1Btn', 'copyBtnText', 'copyIcon', phase1FindingsData, 'Copy Phase 1 Findings');
    setupCopyButton('copyPhase2Btn', 'copyBtnText2', 'copyIcon2', phase2FindingsData, 'Copy Phase 2 Findings');
    setupCopyButton('copyPhase3Btn', 'copyBtnText3', 'copyIcon3', phase3FindingsData, 'Copy Phase 3 Findings');
    setupCopyButton('copyPhase4Btn', 'copyBtnText4', 'copyIcon4', phase4FindingsData, 'Copy Phase 4 Findings');
    setupCopyButton('copyPhase5Btn', 'copyBtnText5', 'copyIcon5', phase5FindingsData, 'Copy Phase 5 Findings');
    setupCopyButton('copyPhase6Btn', 'copyBtnText6', 'copyIcon6', phase6FindingsData, 'Copy Phase 6 Findings');

    document.getElementById('planForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const intent = document.getElementById('intentInput').value;
      const resContainer = document.getElementById('planResult');
      const output = document.getElementById('planOutput');
      const execBtn = document.getElementById('executeBtn');
      const telemetryContainer = document.getElementById('telemetryResult');

      resContainer.style.display = 'block';
      telemetryContainer.style.display = 'none';
      execBtn.style.display = 'none';
      output.textContent = 'Generating plan...';

      try {
        const res = await fetch('/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent })
        });
        const data = await res.json();
        currentPlanId = data.id;
        output.textContent = JSON.stringify(data, null, 2);
        if (data.id) {
          execBtn.style.display = 'inline-block';
        }
      } catch (err) {
        output.textContent = 'Error: ' + err.message;
      }
    });

    document.getElementById('executeBtn').addEventListener('click', async () => {
      if (!currentPlanId) return;
      const execBtn = document.getElementById('executeBtn');
      const telemetryContainer = document.getElementById('telemetryResult');
      const telemetryCards = document.getElementById('telemetryCards');
      const telemetryOutput = document.getElementById('telemetryOutput');

      execBtn.disabled = true;
      execBtn.textContent = 'Executing...';
      telemetryContainer.style.display = 'block';
      telemetryCards.innerHTML = '<p style="color: var(--text-dim);">Running DAG scheduler and collecting telemetry...</p>';
      telemetryOutput.textContent = '';

      try {
        const res = await fetch('/plans/' + currentPlanId + '/execute', { method: 'POST' });
        const data = await res.json();
        execBtn.disabled = false;
        execBtn.textContent = '⚡ Re-Execute Plan';

        const diag = data.diagnostics || {};
        const metrics = diag.metrics || {};
        const diagInfo = diag.diagnostics || {};

        const statusColor = data.failed === 0 ? '#4ade80' : '#f87171';
        const slowestLayerText = diagInfo.slowestLayer ? 'Layer ' + diagInfo.slowestLayer.layerIndex + ' (' + diagInfo.slowestLayer.durationMs + 'ms)' : 'N/A';
        const slowestToolText = diagInfo.slowestTool ? diagInfo.slowestTool.slug + ' (' + diagInfo.slowestTool.durationMs + 'ms)' : 'N/A';
        const totalTokens = (metrics.models && metrics.models.totalTokens && metrics.models.totalTokens.totalTokens) || 0;
        const totalTime = metrics.totalExecutionTimeMs || 0;

        telemetryCards.innerHTML = [
          '<div style="background: #090d16; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border);">',
          '  <div style="font-size: 0.75rem; color: var(--text-dim);">STATUS & TIME</div>',
          '  <div style="font-size: 1.1rem; font-weight: 700; color: ' + statusColor + ';">',
          '    ' + data.succeeded + '/' + data.totalTasks + ' Done (' + totalTime + 'ms)',
          '  </div>',
          '</div>',
          '<div style="background: #090d16; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border);">',
          '  <div style="font-size: 0.75rem; color: var(--text-dim);">SLOWEST LAYER</div>',
          '  <div style="font-size: 0.95rem; font-weight: 600; color: #38bdf8;">' + slowestLayerText + '</div>',
          '</div>',
          '<div style="background: #090d16; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border);">',
          '  <div style="font-size: 0.75rem; color: var(--text-dim);">SLOWEST TOOL</div>',
          '  <div style="font-size: 0.95rem; font-weight: 600; color: #fbbf24;">' + slowestToolText + '</div>',
          '</div>',
          '<div style="background: #090d16; padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border);">',
          '  <div style="font-size: 0.75rem; color: var(--text-dim);">TOTAL TOKENS</div>',
          '  <div style="font-size: 1.1rem; font-weight: 700; color: #a78bfa;">' + totalTokens + '</div>',
          '</div>'
        ].join('');

        telemetryOutput.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        execBtn.disabled = false;
        execBtn.textContent = '⚡ Execute Plan';
        telemetryOutput.textContent = 'Error executing plan: ' + err.message;
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
      const health = healthAnalyzer.context();
      jsonResponse(res, 200, {
        status: health.score.status === 'critical' ? 'degraded' : 'ok',
        platform: PLATFORM_NAME,
        version: process.env['APP_VERSION'] || '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        healthScore: health.score,
        services: health.services,
      });
      return;
    }

    // ── Phase 1 Findings ──
    if (path === '/phase1-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE1_FINDINGS_TEXT);
      return;
    }

    // ── Phase 2 Findings ──
    if (path === '/phase2-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE2_FINDINGS_TEXT);
      return;
    }

    // ── Phase 3 Findings ──
    if (path === '/phase3-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE3_FINDINGS_TEXT);
      return;
    }

    // ── Phase 4 Findings ──
    if (path === '/phase4-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE4_FINDINGS_TEXT);
      return;
    }

    // ── Phase 5 Findings ──
    if (path === '/phase5-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE5_FINDINGS_TEXT);
      return;
    }

    // ── Phase 6 Findings ──
    if (path === '/phase6-findings' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.end(PHASE6_FINDINGS_TEXT);
      return;
    }

    // ── Health Domain ──
    if (path === '/health/status' && req.method === 'GET') {
      jsonResponse(res, 200, healthAnalyzer.context());
      return;
    }

    if (path === '/health/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': corsOrigin(),
      });
      res.write(`event: snapshot\ndata: ${JSON.stringify(healthAnalyzer.context())}\n\n`);
      healthStreamClients.add(res);
      req.on('close', () => healthStreamClients.delete(res));
      return;
    }

    if (path === '/health/events' && req.method === 'POST') {
      const body = await readBody(req);
      validateHealthEvent(body);
      const event = healthCollector.ingest(createHealthEvent({
        ...body,
        service: body.service,
        level: body.level,
        message: body.message,
      }));
      persistHealth();
      jsonResponse(res, 202, { accepted: true, event });
      return;
    }

    if (path === '/health/heartbeat' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.service) {
        jsonResponse(res, 400, { error: 'service is required' });
        return;
      }
      const service = healthCollector.heartbeat(body.service, body.version);
      persistHealth();
      jsonResponse(res, 202, {
        accepted: true,
        service,
      });
      return;
    }

    if (path === '/health/metrics' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.service) {
        jsonResponse(res, 400, { error: 'service is required' });
        return;
      }
      validateHealthMetric(body);
      persistHealth();
      jsonResponse(res, 202, { accepted: true, metric: healthCollector.recordMetric({
        ...body,
        timestamp: body.timestamp || new Date().toISOString(),
      }) });
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
    const planMatch = path.match(/^\/plans\/([^/]+)$/);
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
    const executeMatch = path.match(/^\/plans\/([^/]+)\/execute$/);
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

      const diagnostics = taskManager.getDiagnostics();
      if (diagnostics) {
        planTelemetryStore.set(planId, diagnostics);
      }

      const succeeded = results.filter(r => r.status === 'completed').length;
      jsonResponse(res, 200, {
        planId,
        totalTasks: results.length,
        succeeded,
        failed: results.length - succeeded,
        tasks: results,
        diagnostics: diagnostics ?? null,
      });
      return;
    }

    // ── GET /plans/:id/telemetry — get execution telemetry diagnostics & trace ──
    const telemetryMatch = path.match(/^\/plans\/([^/]+)\/telemetry$/);
    if (telemetryMatch && req.method === 'GET') {
      const planId = telemetryMatch[1];
      const telemetry = planTelemetryStore.get(planId);
      if (!telemetry) {
        jsonResponse(res, 404, { error: `Telemetry not found for plan: ${planId}` });
        return;
      }
      jsonResponse(res, 200, telemetry);
      return;
    }

    // ── GET /telemetry — latest telemetry diagnostics & history ──
    if (path === '/telemetry' && req.method === 'GET') {
      const latestDiagnostics = taskManager.getDiagnostics();
      jsonResponse(res, 200, {
        latest: latestDiagnostics ?? null,
        plansWithTelemetry: Array.from(planTelemetryStore.keys()),
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
    if (
      path.startsWith('/health/') &&
      req.method === 'POST' &&
      /required|invalid|must be|between|characters or fewer|non-negative/i.test(error.message || '')
    ) {
      jsonResponse(res, 400, { error: error.message });
      return;
    }
    logger.error(`Request handler error: ${error.message}`, error.stack);
    const isDev = process.env['NODE_ENV'] === 'development';
    jsonResponse(res, 500, {
      error: 'Internal Server Error',
      ...(isDev ? { message: error.message } : {}),
    });
  }
});

server.listen(PORT, '0.0.0.0', async () => {
  await loadPlanStore();
  try {
    healthCollector.restore(await healthStorage.load());
    healthCollector.heartbeat('api', process.env['APP_VERSION'] || '1.0.0');
  } catch (error: any) {
    logger.warn(`Health storage unavailable; using memory only: ${error.message}`);
  }
  const heartbeatInterval = setInterval(() => {
    healthCollector.heartbeat('api', process.env['APP_VERSION'] || '1.0.0');
  }, 15000);
  heartbeatInterval.unref();
  for (const signal of [...collectCIHealth(), ...collectDeploymentHealth()]) {
    healthCollector.ingest(createHealthEvent(signal));
  }
  try {
    const packageJson = JSON.parse(await readFileAsync('package.json', 'utf8'));
    const [workspaceFileExists, lockfileExists] = await Promise.all([
      access('pnpm-workspace.yaml').then(() => true).catch(() => false),
      access('pnpm-lock.yaml').then(() => true).catch(() => false),
    ]);
    for (const signal of collectDependencyHealth(packageJson, { workspaceFileExists, lockfileExists })) {
      healthCollector.ingest(createHealthEvent(signal));
    }
  } catch (error: any) {
    logger.warn(`Dependency health collection skipped: ${error.message}`);
  }
  persistHealth();
  logger.info(`==================================================`);
  logger.info(`${PLATFORM_NAME} API Server listening on http://localhost:${PORT}`);
  logger.info(`Auth:    ${auth.getKeyCount()} key(s) configured`);
  logger.info(`Endpoints:`);
  logger.info(`  GET  /health             — Health check (public)`);
  logger.info(`  GET  /health/status      — Repository health context`);
  logger.info(`  GET  /health/stream      — Live health SSE stream`);
  logger.info(`  POST /health/events      — Ingest health events`);
  logger.info(`  POST /health/heartbeat   — Service heartbeat`);
  logger.info(`  POST /health/metrics     — Ingest health metrics`);
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
