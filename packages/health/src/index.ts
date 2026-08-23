import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type HealthLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthEvent {
  id: string;
  service: string;
  level: HealthLevel;
  message: string;
  createdAt: string;
  environment: string;
  version: string;
  gitCommit?: string;
  traceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthMetric {
  service: string;
  timestamp: string;
  latencyMs?: number;
  requests?: number;
  errorRate?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  queueSize?: number;
}

export interface ServiceHealth {
  name: string;
  version: string;
  status: ServiceStatus;
  heartbeat: string;
  lastEvent?: string;
}

export interface HealthScore {
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  penalties: Record<string, number>;
}

export interface HealthContext {
  generatedAt: string;
  score: HealthScore;
  services: ServiceHealth[];
  activeIncidents: Array<{ service: string; message: string; level: HealthLevel; createdAt: string }>;
  recentEvents: HealthEvent[];
  recentMetrics: HealthMetric[];
}

export interface HealthSnapshot {
  services: ServiceHealth[];
  events: HealthEvent[];
  metrics: HealthMetric[];
}

export interface HealthStorageAdapter {
  load(): Promise<HealthSnapshot>;
  save(snapshot: HealthSnapshot): Promise<void>;
}

export class MemoryAdapter implements HealthStorageAdapter {
  private snapshot: HealthSnapshot = { services: [], events: [], metrics: [] };

  async load(): Promise<HealthSnapshot> {
    return structuredClone(this.snapshot);
  }

  async save(snapshot: HealthSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }
}

/** Atomic JSON persistence, suitable for local development and Railway volumes. */
export class FileAdapter implements HealthStorageAdapter {
  constructor(
    private readonly filePath = process.env.HEALTH_STORAGE_FILE || '.data/health/snapshot.json',
  ) {}

  async load(): Promise<HealthSnapshot> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        services: Array.isArray(parsed.services) ? parsed.services : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { services: [], events: [], metrics: [] };
      throw error;
    }
  }

  async save(snapshot: HealthSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tempPath, JSON.stringify(snapshot), 'utf8');
    await rename(tempPath, this.filePath);
  }
}

const MAX_EVENTS = 1000;
const MAX_METRICS = 1000;
const HEARTBEAT_TIMEOUT_MS = 90_000;

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function createHealthEvent(
  input: Omit<Partial<HealthEvent>, 'id'> & Pick<HealthEvent, 'service' | 'level' | 'message'>,
): HealthEvent {
  return {
    id: randomUUID(),
    service: input.service,
    level: input.level,
    message: input.message,
    createdAt: input.createdAt || new Date().toISOString(),
    environment: stringValue(input.environment, process.env.NODE_ENV || 'development'),
    version: stringValue(input.version, process.env.APP_VERSION || 'unknown'),
    gitCommit: input.gitCommit || process.env.GIT_COMMIT,
    traceId: input.traceId,
    requestId: input.requestId,
    metadata: input.metadata,
  };
}

const HEALTH_LEVELS = new Set<HealthLevel>(['debug', 'info', 'warn', 'error', 'fatal']);

export function validateHealthEvent(input: unknown): asserts input is Omit<HealthEvent, 'id'> & Partial<Pick<HealthEvent, 'id'>> {
  const event = input as Partial<HealthEvent> | null;
  if (!event || typeof event !== 'object') throw new Error('Health event must be an object');
  if (!stringValue(event.service, '')) throw new Error('service is required');
  if (!HEALTH_LEVELS.has(event.level as HealthLevel)) throw new Error('level is invalid');
  if (!stringValue(event.message, '') || event.message.length > 4000) {
    throw new Error('message is required and must be 4000 characters or fewer');
  }
  if (event.createdAt && (Number.isNaN(Date.parse(event.createdAt)) || !event.createdAt.includes('T'))) {
    throw new Error('createdAt must be an ISO timestamp');
  }
}

export function validateHealthMetric(input: unknown): asserts input is HealthMetric {
  const metric = input as Partial<HealthMetric> | null;
  if (!metric || typeof metric !== 'object' || !stringValue(metric.service, '')) {
    throw new Error('service is required');
  }
  for (const key of ['latencyMs', 'requests', 'errorRate', 'cpuPercent', 'memoryPercent', 'queueSize'] as const) {
    if (metric[key] !== undefined && (typeof metric[key] !== 'number' || !Number.isFinite(metric[key]) || metric[key] < 0)) {
      throw new Error(`${key} must be a non-negative number`);
    }
  }
  if (metric.errorRate !== undefined && metric.errorRate > 1) throw new Error('errorRate must be between 0 and 1');
  if (metric.cpuPercent !== undefined && metric.cpuPercent > 100) throw new Error('cpuPercent must be between 0 and 100');
  if (metric.memoryPercent !== undefined && metric.memoryPercent > 100) throw new Error('memoryPercent must be between 0 and 100');
}

/** Writes one-line JSON logs that can be ingested by Railway, Loki, or ELK. */
export class StructuredHealthLogger {
  constructor(private readonly service: string, private readonly defaults: Partial<HealthEvent> = {}) {}

  log(level: HealthLevel, message: string, metadata?: Record<string, unknown>): HealthEvent {
    const event = createHealthEvent({ ...this.defaults, service: this.service, level, message, metadata });
    const line = JSON.stringify({ ...event, timestamp: event.createdAt });
    if (level === 'error' || level === 'fatal') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
    return event;
  }

  debug(message: string, metadata?: Record<string, unknown>) { return this.log('debug', message, metadata); }
  info(message: string, metadata?: Record<string, unknown>) { return this.log('info', message, metadata); }
  warn(message: string, metadata?: Record<string, unknown>) { return this.log('warn', message, metadata); }
  error(message: string, metadata?: Record<string, unknown>) { return this.log('error', message, metadata); }
}

/** In-memory Phase 1 collector. Replace the storage adapter without changing callers. */
export class HealthCollector extends EventEmitter {
  private readonly services = new Map<string, ServiceHealth>();
  private readonly events: HealthEvent[] = [];
  private readonly metrics: HealthMetric[] = [];

  registerService(input: { name: string; version?: string }): ServiceHealth {
    const service: ServiceHealth = {
      name: input.name,
      version: input.version || process.env.APP_VERSION || 'unknown',
      status: 'healthy',
      heartbeat: new Date().toISOString(),
    };
    this.services.set(service.name, service);
    this.emit('service', service);
    return service;
  }

  heartbeat(name: string, version?: string): ServiceHealth {
    const existing = this.services.get(name) || this.registerService({ name, version });
    existing.heartbeat = new Date().toISOString();
    existing.status = 'healthy';
    if (version) existing.version = version;
    this.services.set(name, existing);
    this.emit('heartbeat', existing);
    return existing;
  }

  ingest(event: HealthEvent): HealthEvent {
    if (!event.service || !event.message || !event.level) throw new Error('Invalid health event');
    if (!this.services.has(event.service)) this.registerService({ name: event.service, version: event.version });
    const service = this.services.get(event.service)!;
    service.lastEvent = event.createdAt;
    if (event.level === 'error' || event.level === 'fatal') service.status = 'unhealthy';
    else if (event.level === 'warn' && service.status === 'healthy') service.status = 'degraded';
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    this.emit('event', event);
    return event;
  }

  recordMetric(metric: HealthMetric): HealthMetric {
    this.metrics.push(metric);
    if (this.metrics.length > MAX_METRICS) this.metrics.splice(0, this.metrics.length - MAX_METRICS);
    this.emit('metric', metric);
    return metric;
  }

  restore(snapshot: HealthSnapshot): void {
    this.services.clear();
    for (const service of snapshot.services) this.services.set(service.name, { ...service });
    this.events.splice(0, this.events.length, ...snapshot.events.slice(-MAX_EVENTS));
    this.metrics.splice(0, this.metrics.length, ...snapshot.metrics.slice(-MAX_METRICS));
  }

  exportState(): HealthSnapshot {
    return {
      services: [...this.services.values()],
      events: this.events.slice(),
      metrics: this.metrics.slice(),
    };
  }

  snapshot(): HealthSnapshot {
    const now = Date.now();
    const services = [...this.services.values()].map((service) => ({
      ...service,
      status: now - new Date(service.heartbeat).getTime() > HEARTBEAT_TIMEOUT_MS ? 'unknown' as const : service.status,
    }));
    return { services, events: this.events.slice(-100), metrics: this.metrics.slice(-100) };
  }
}

export class HealthAnalyzer {
  constructor(private readonly collector: HealthCollector) {}

  score(): HealthScore {
    const { services, events, metrics } = this.collector.snapshot();
    const unavailable = services.filter((s) => s.status === 'unhealthy' || s.status === 'unknown').length;
    const warnings = services.filter((s) => s.status === 'degraded').length;
    const errors = events.filter((e) => e.level === 'error' || e.level === 'fatal').length;
    const recentMetrics = metrics.slice(-20);
    const errorRate = recentMetrics.length
      ? recentMetrics.reduce((sum, metric) => sum + (metric.errorRate || 0), 0) / recentMetrics.length
      : 0;
    const latency = recentMetrics.length
      ? recentMetrics.reduce((sum, metric) => sum + (metric.latencyMs || 0), 0) / recentMetrics.length
      : 0;
    const penalties = {
      availability: Math.min(30, unavailable * 15 + warnings * 5),
      errors: Math.min(25, errors * 2 + errorRate * 25),
      performance: Math.min(20, latency > 1000 ? 20 : latency > 500 ? 10 : 0),
      tests: 0,
      dependencies: 0,
      security: 0,
    };
    const score = Math.max(0, Math.round(100 - Object.values(penalties).reduce((a, b) => a + b, 0)));
    return { score, penalties, status: score >= 95 ? 'excellent' : score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical' };
  }

  context(): HealthContext {
    const snapshot = this.collector.snapshot();
    const activeIncidents = snapshot.events
      .filter((event) => event.level === 'error' || event.level === 'fatal')
      .slice(-20)
      .map(({ service, message, level, createdAt }) => ({ service, message, level, createdAt }));
    return {
      generatedAt: new Date().toISOString(),
      score: this.score(),
      services: snapshot.services,
      activeIncidents,
      recentEvents: snapshot.events,
      recentMetrics: snapshot.metrics,
    };
  }
}

export interface CollectorResult {
  service: string;
  level: HealthLevel;
  message: string;
  createdAt?: string;
  version?: string;
  environment?: string;
  gitCommit?: string;
  metadata?: Record<string, unknown>;
}

export function collectCIHealth(env: NodeJS.ProcessEnv = process.env): CollectorResult[] {
  if (!env.CI && !env.GITHUB_ACTIONS) return [];
  return [{
    service: 'ci',
    level: env.GITHUB_RUN_ID ? 'info' : 'warn',
    message: env.GITHUB_RUN_ID ? 'CI workflow is running' : 'CI environment detected without GitHub run metadata',
    metadata: {
      commit: env.GITHUB_SHA,
      branch: env.GITHUB_REF_NAME,
      runId: env.GITHUB_RUN_ID,
    },
  }];
}

export function collectDependencyHealth(
  packageJson: unknown,
  options: boolean | { workspaceFileExists?: boolean; lockfileExists?: boolean; workspacePackageNames?: string[] } = {},
): CollectorResult[] {
  const checks = typeof options === 'boolean' ? { lockfileExists: options } : options;
  const pkg = packageJson as { workspaces?: unknown; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null;
  const results: CollectorResult[] = [];
  if (!pkg || typeof pkg !== 'object') {
    return [{ service: 'dependencies', level: 'error', message: 'package.json could not be read' }];
  }
  if (checks.workspaceFileExists === false) {
    results.push({ service: 'dependencies', level: 'error', message: 'pnpm-workspace.yaml is missing' });
  }
  if (checks.lockfileExists === false) results.push({ service: 'dependencies', level: 'error', message: 'pnpm-lock.yaml is missing' });
  if (!pkg.workspaces && checks.workspaceFileExists !== true && checks.workspacePackageNames === undefined) {
    results.push({ service: 'dependencies', level: 'warn', message: 'Workspace metadata is not declared in package.json' });
  }
  const workspaceNames = checks.workspacePackageNames || [];
  const duplicateWorkspaceNames = workspaceNames.filter((name, index) => workspaceNames.indexOf(name) !== index);
  if (duplicateWorkspaceNames.length) {
    results.push({
      service: 'dependencies',
      level: 'error',
      message: 'Duplicate workspace package names detected',
      metadata: { duplicateNames: [...new Set(duplicateWorkspaceNames)] },
    });
  }
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const duplicateNames = Object.keys(all).filter((name) => name.startsWith('@ai-agent-platform/'));
  return results.length ? results : [{
    service: 'dependencies',
    level: 'info',
    message: `Dependency metadata is healthy (${duplicateNames.length} platform packages detected)`,
  }];
}

export function collectDeploymentHealth(env: NodeJS.ProcessEnv = process.env): CollectorResult[] {
  if (!env.RAILWAY_ENVIRONMENT && !env.RAILWAY_PROJECT_ID) return [];
  return [{
    service: 'deployment',
    level: 'info',
    message: 'Railway deployment environment detected',
    metadata: {
      environment: env.RAILWAY_ENVIRONMENT,
      serviceId: env.RAILWAY_SERVICE_ID,
      deploymentId: env.RAILWAY_DEPLOYMENT_ID,
      commit: env.RAILWAY_GIT_COMMIT_SHA || env.GITHUB_SHA,
    },
  }];
}

export interface HealthClientOptions {
  baseUrl: string;
  token?: string;
  service: string;
  version?: string;
}

/** Minimal SDK for services to publish events to the API health collector. */
export function createHealthClient(options: HealthClientOptions) {
  const send = async (path: string, body: unknown) => {
    const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Health API returned ${response.status}`);
    return response.json();
  };
  return {
    heartbeat: () => send('/health/heartbeat', { service: options.service, version: options.version }),
    event: (event: Omit<Partial<HealthEvent>, 'service' | 'version'> & Pick<HealthEvent, 'level' | 'message'>) =>
      send('/health/events', { ...event, service: options.service, version: options.version }),
    metric: (metric: Omit<HealthMetric, 'service'>) => send('/health/metrics', { ...metric, service: options.service }),
  };
}