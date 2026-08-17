import { createLogger } from '@ai-agent-platform/shared';
import { createHash } from 'node:crypto';

const logger = createLogger('Automation');

export type RiskTier = 'read-only' | 'low-risk' | 'high-risk';

export interface ActionDescriptor {
  slug: string;
  tier: RiskTier;
  description: string;
  confirmSummary?: string;
}

export const ACTION_POLICY: Record<string, ActionDescriptor> = {
  get_trainer_stats: { slug: 'get_trainer_stats', tier: 'read-only', description: 'Fetch trainer stats' },
  search_trainers: { slug: 'search_trainers', tier: 'read-only', description: 'Search trainers' },
  get_leaderboard: { slug: 'get_leaderboard', tier: 'read-only', description: 'Get leaderboard' },
  get_user_profile: { slug: 'get_user_profile', tier: 'read-only', description: 'Get user profile' },
  search_web: { slug: 'search_web', tier: 'read-only', description: 'Search the web' },
  send_notification: { slug: 'send_notification', tier: 'low-risk', description: 'Send a notification to a user or opted-in channel' },
  create_reminder: { slug: 'create_reminder', tier: 'low-risk', description: 'Create a personal reminder' },
  save_user_preference: { slug: 'save_user_preference', tier: 'low-risk', description: 'Save a user preference' },
  send_announcement: { slug: 'send_announcement', tier: 'high-risk', description: 'Broadcast an announcement to a channel', confirmSummary: 'Post an announcement to a channel' },
  manage_roles: { slug: 'manage_roles', tier: 'high-risk', description: 'Change server roles', confirmSummary: 'Modify server roles' },
  manage_channels: { slug: 'manage_channels', tier: 'high-risk', description: 'Create/delete/rename channels', confirmSummary: 'Modify channels' },
  manage_server_config: { slug: 'manage_server_config', tier: 'high-risk', description: 'Change server configuration', confirmSummary: 'Change server configuration' },
  modify_external_account: { slug: 'modify_external_account', tier: 'high-risk', description: 'Modify an external account', confirmSummary: 'Modify an external account' },
};

export function getActionTier(slug: string): RiskTier | null {
  return ACTION_POLICY[slug]?.tier ?? null;
}

export function isHighRisk(slug: string): boolean {
  return getActionTier(slug) === 'high-risk';
}

export type AgentLifecycle =
  | 'CREATED' | 'QUEUED' | 'RUNNING' | 'WAITING_FOR_TOOL'
  | 'WAITING_FOR_CONFIRMATION' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

const ALLOWED_TRANSITIONS: Record<AgentLifecycle, AgentLifecycle[]> = {
  CREATED: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'CANCELLED', 'EXPIRED'],
  RUNNING: ['WAITING_FOR_TOOL', 'WAITING_FOR_CONFIRMATION', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'],
  WAITING_FOR_TOOL: ['RUNNING', 'FAILED', 'CANCELLED', 'EXPIRED'],
  WAITING_FOR_CONFIRMATION: ['RUNNING', 'CANCELLED', 'EXPIRED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const TERMINAL: Set<AgentLifecycle> = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED']);

export class LifecycleMachine {
  private state: AgentLifecycle;
  constructor(initial: AgentLifecycle = 'CREATED') { this.state = initial; }
  get current(): AgentLifecycle { return this.state; }
  get isTerminal(): boolean { return TERMINAL.has(this.state); }
  transition(next: AgentLifecycle): void {
    if (this.isTerminal) throw new Error(`Cannot transition from terminal state ${this.state}`);
    if (!ALLOWED_TRANSITIONS[this.state].includes(next)) {
      throw new Error(`Invalid lifecycle transition: ${this.state} → ${next}`);
    }
    const prev = this.state;
    this.state = next;
    logger.info(`Lifecycle ${prev} → ${next}`);
  }
}

export function contentFingerprint(input: { source?: string; title?: string; snippet?: string; content?: string }): string {
  const normalized = [input.source ?? '', input.title ?? '', input.snippet ?? '', input.content ?? '']
    .join('|').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export interface RateLimitConfig {
  maxScheduledTasksPerUser: number;
  maxScheduledTasksPerGuild: number;
  maxScheduledTasksGlobal: number;
  maxConcurrentTasks: number;
  maxWebSearchesPerTask: number;
  maxToolCallsPerTask: number;
  maxExecutionMs: number;
  notificationCooldownMs: number;
  perUserWindowMs: number;
  perUserWindowMax: number;
  perGuildWindowMs: number;
  perGuildWindowMax: number;
  globalWindowMs: number;
  globalWindowMax: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  maxScheduledTasksPerUser: 10,
  maxScheduledTasksPerGuild: 50,
  maxScheduledTasksGlobal: 500,
  maxConcurrentTasks: 5,
  maxWebSearchesPerTask: 3,
  maxToolCallsPerTask: 5,
  maxExecutionMs: 60_000,
  notificationCooldownMs: 5 * 60 * 1000,
  perUserWindowMs: 60_000,
  perUserWindowMax: 5,
  perGuildWindowMs: 60_000,
  perGuildWindowMax: 20,
  globalWindowMs: 60_000,
  globalWindowMax: 50,
};

interface WindowCounter { count: number; windowStart: number; }

export class RateLimitedExecutor {
  private active = 0;
  private perUser = new Map<string, WindowCounter>();
  private perGuild = new Map<string, WindowCounter>();
  private global: WindowCounter = { count: 0, windowStart: Date.now() };
  private lastNotification = new Map<string, number>();

  constructor(private config: RateLimitConfig = DEFAULT_RATE_LIMITS) {}

  private slide(c: WindowCounter, windowMs: number): number {
    const now = Date.now();
    if (now - c.windowStart >= windowMs) { c.count = 0; c.windowStart = now; }
    return c.count;
  }

  get concurrency(): number { return this.active; }
  canRunConcurrent(): boolean { return this.active < this.config.maxConcurrentTasks; }

  async acquireConcurrency(): Promise<() => void> {
    if (this.active >= this.config.maxConcurrentTasks) throw new Error('Max concurrent tasks reached');
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }

  allowUser(userId: string): boolean {
    let c = this.perUser.get(userId);
    if (!c) { c = { count: 0, windowStart: Date.now() }; this.perUser.set(userId, c); }
    const n = this.slide(c, this.config.perUserWindowMs);
    if (n >= this.config.perUserWindowMax) return false;
    c.count++; return true;
  }

  allowGuild(guildId: string): boolean {
    let c = this.perGuild.get(guildId);
    if (!c) { c = { count: 0, windowStart: Date.now() }; this.perGuild.set(guildId, c); }
    const n = this.slide(c, this.config.perGuildWindowMs);
    if (n >= this.config.perGuildWindowMax) return false;
    c.count++; return true;
  }

  allowGlobal(): boolean {
    const n = this.slide(this.global, this.config.globalWindowMs);
    if (n >= this.config.globalWindowMax) return false;
    this.global.count++; return true;
  }

  allowNotification(key: string): boolean {
    const last = this.lastNotification.get(key) ?? 0;
    const now = Date.now();
    if (now - last < this.config.notificationCooldownMs) return false;
    this.lastNotification.set(key, now);
    return true;
  }
}

export interface Confirmation {
  id: string;
  actionSlug: string;
  actionSummary: string;
  userId: string;
  channelId: string;
  expiresAt: string;
  createdAt: string;
  consumed: number;
}

export const DEFAULT_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
