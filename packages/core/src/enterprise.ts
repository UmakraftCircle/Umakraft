import { createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from '@ai-agent-platform/integrations';

const logger = createLogger('WorkspaceManager');

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  ownerId: string;
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  tools: string[];
  agents: string[];
  workflows: string[];
}

export class WorkspaceManager {
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    const db = await getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        settings TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.initialized = true;
    logger.info('Workspace tables initialized.');
  }

  public async createWorkspace(ws: Omit<Workspace, 'createdAt' | 'updatedAt'>): Promise<Workspace> {
    await this.init();
    const db = await getDatabase();
    const now = new Date().toISOString();
    const full: Workspace = {
      ...ws,
      settings: ws.settings || {},
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(`
      INSERT INTO workspaces (id, organization_id, name, owner_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        settings = excluded.settings,
        updated_at = excluded.updated_at
    `).run(
      full.id, full.organizationId, full.name, full.ownerId,
      JSON.stringify(full.settings), full.createdAt, full.updatedAt
    );

    return full;
  }

  public async getWorkspace(id: string): Promise<Workspace | null> {
    await this.init();
    const db = await getDatabase();
    const row = db.prepare(`SELECT * FROM workspaces WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      ownerId: row.owner_id,
      settings: row.settings ? JSON.parse(row.settings) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class PluginRegistry {
  private plugins = new Map<string, PluginDefinition>();

  public register(plugin: PluginDefinition): void {
    this.plugins.set(plugin.id, plugin);
    logger.info(`Registered enterprise plugin: ${plugin.name} (${plugin.id}) v${plugin.version}`);
  }

  public get(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  public list(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}
