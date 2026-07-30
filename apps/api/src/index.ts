import * as http from 'http';
import { createLogger, PLATFORM_NAME, ExecutionPlan } from '@ai-agent-platform/shared';
import { MockAIService } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager, MODELS } from '@ai-agent-platform/core';
import { AuthMiddleware } from './auth.js';

// Register all platform tools
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools as fanTrackerTools } from '@ai-agent-platform/fan-tracker';
import { allDomainTools as prMonitorTools } from '@ai-agent-platform/pr-monitor';

const logger = createLogger('API-Server');
const PORT = parseInt(process.env['PORT'] || '3000', 10);

// Bootstrap tool registry
for (const tool of allTools) {
  toolRegistry.register(tool);
}
for (const integration of allIntegrations) {
  toolRegistry.register(integration);
}
for (const domainTool of [...fanTrackerTools, ...prMonitorTools]) {
  toolRegistry.register(domainTool);
}

logger.info(`Registered ${toolRegistry.getDeclarativeSchemas().length} tools in API server.`);

// Core services
const aiService = new MockAIService('claude-3-5-sonnet');
const planner = new Planner(aiService, toolRegistry);
const taskManager = new TaskManager(toolRegistry);

// In-memory plan store (volatile — plans are persisted to SQLite via the database-store-result
// tool on completion. On restart, only currently-executing plans are lost; completed plans
// can be retrieved from the database.)
const planStore = new Map<string, ExecutionPlan>();

// ── JSON helpers ──

function jsonResponse(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env['CORS_ORIGIN'] || '',
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

    // ── GET /plans — list all plans ──
    if (path === '/plans' && req.method === 'GET') {
      const plans = Array.from(planStore.values()).map(p => ({
        id: p.id,
        intent: p.intent,
        taskCount: p.tasks.size,
        metadata: p.metadata
      }));
      jsonResponse(res, 200, { count: plans.length, plans });
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

    // ── POST /plans/:id/execute — execute a plan ──
    const executeMatch = path.match(/^\/plans\/(.+)\/execute$/);
    if (executeMatch && req.method === 'POST') {
      const planId = executeMatch[1];
      const plan = planStore.get(planId);

      if (!plan) {
        jsonResponse(res, 404, { error: `Plan not found: ${planId}` });
        return;
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
    jsonResponse(res, 500, { error: 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
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
