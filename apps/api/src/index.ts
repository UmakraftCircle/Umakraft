import * as http from 'http';
import { createLogger, PLATFORM_NAME, ExecutionPlan } from '@ai-agent-platform/shared';
import { MockAIService } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager } from '@ai-agent-platform/core';

// Register all platform tools
import { allTools, webTools, notificationTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools } from '@ai-agent-platform/fan-tracker';

const logger = createLogger('API-Server');
const PORT = parseInt(process.env['PORT'] || '3000', 10);

// Bootstrap tool registry
for (const tool of [...allTools, ...webTools, ...notificationTools]) {
  toolRegistry.register(tool);
}
for (const integration of allIntegrations) {
  toolRegistry.register(integration);
}
for (const domainTool of allDomainTools) {
  toolRegistry.register(domainTool);
}

logger.info(`Registered ${toolRegistry.getDeclarativeSchemas().length} tools in API server.`);

// Core services
const aiService = new MockAIService('claude-3-5-sonnet');
const planner = new Planner(aiService, toolRegistry);
const taskManager = new TaskManager(toolRegistry);

// In-memory plan store (backed by SQLite on plan completion)
const planStore = new Map<string, ExecutionPlan>();

// ── JSON helpers ──

function jsonResponse(res: http.ServerResponse, status: number, data: any): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
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

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    jsonResponse(res, 204, null);
    return;
  }

  const { path, params } = parseUrl(req);

  logger.info(`${req.method} ${path}`);

  try {
    // ── Health ──
    if (path === '/health' && req.method === 'GET') {
      jsonResponse(res, 200, {
        status: 'ok',
        platform: PLATFORM_NAME,
        version: '1.0.0',
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
      const executedPlan = await taskManager.executePlan(plan);

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
      const { MODELS } = await import('@ai-agent-platform/core');
      jsonResponse(res, 200, { models: Object.values(MODELS) });
      return;
    }

    // ── 404 ──
    jsonResponse(res, 404, { error: 'Not Found', path });
  } catch (error: any) {
    logger.error(`Request handler error: ${error.message}`);
    jsonResponse(res, 500, { error: error.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  logger.info(`==================================================`);
  logger.info(`${PLATFORM_NAME} API Server listening on http://localhost:${PORT}`);
  logger.info(`Endpoints:`);
  logger.info(`  GET  /health             — Health check`);
  logger.info(`  GET  /tools              — List registered tools`);
  logger.info(`  POST /plans              — Submit plan intent`);
  logger.info(`  GET  /plans              — List all plans`);
  logger.info(`  GET  /plans/:id          — Get plan details`);
  logger.info(`  POST /plans/:id/execute  — Execute a plan`);
  logger.info(`  GET  /models             — Available AI models`);
  logger.info(`==================================================`);
});
