import { createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from '@ai-agent-platform/integrations';

const logger = createLogger('KnowledgeGraph');

// ── Types ──

export interface KnowledgeNode {
  id: string;
  type: 'entity' | 'concept' | 'document' | 'tool' | 'domain';
  label: string;
  description?: string;
  metadata?: Record<string, any>; // stored as JSON
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: string;   // e.g. 'uses', 'depends_on', 'produces', 'implements'
  weight?: number;        // 0-1, strength of relationship
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface TraversalResult {
  node: KnowledgeNode;
  edges: KnowledgeEdge[];
  depth: number;
}

// ── KnowledgeGraph ──

export class KnowledgeGraph {
  private initialized = false;

  /**
   * Create the knowledge graph tables in SQLite.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    const db = await getDatabase();

    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relationship TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        metadata TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, target_id, relationship),
        FOREIGN KEY (source_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
      );
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_source ON knowledge_edges(source_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_edges_target ON knowledge_edges(target_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type);`);

    logger.info('Knowledge Graph tables initialized.');
    this.initialized = true;
  }

  // ── Node operations ──

  /**
   * Upsert a knowledge node.
   */
  public async upsertNode(node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<KnowledgeNode> {
    await this.init();
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result: KnowledgeNode = {
      ...node,
      createdAt: node.createdAt || now,
      updatedAt: node.updatedAt || now,
    };

    db.prepare(`
      INSERT INTO knowledge_nodes (id, type, label, description, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        label = excluded.label,
        description = excluded.description,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `).run(
      result.id, result.type, result.label,
      result.description || null,
      result.metadata ? JSON.stringify(result.metadata) : null,
      result.createdAt, result.updatedAt
    );

    logger.debug(`Upserted knowledge node: ${node.id} (${node.type}: ${node.label})`);
    return result;
  }

  /**
   * Get a node by ID.
   */
  public async getNode(id: string): Promise<KnowledgeNode | null> {
    await this.init();
    const db = await getDatabase();
    const row = db.prepare(`SELECT * FROM knowledge_nodes WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return this.rowToNode(row);
  }

  /**
   * Search nodes by label or description (SQL LIKE).
   */
  public async searchNodes(query: string, type?: KnowledgeNode['type']): Promise<KnowledgeNode[]> {
    await this.init();
    const db = await getDatabase();

    let sql = `SELECT * FROM knowledge_nodes WHERE (label LIKE ? OR description LIKE ?)`;
    const params: any[] = [`%${query}%`, `%${query}%`];

    if (type) {
      sql += ` AND type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY updated_at DESC LIMIT 50`;

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.rowToNode(r));
  }

  /**
   * List all nodes of a given type.
   */
  public async listNodes(type?: KnowledgeNode['type']): Promise<KnowledgeNode[]> {
    await this.init();
    const db = await getDatabase();

    let sql = `SELECT * FROM knowledge_nodes`;
    const params: any[] = [];

    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY updated_at DESC`;

    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map(r => this.rowToNode(r));
  }

  /**
   * Delete a node and all its edges.
   */
  public async deleteNode(id: string): Promise<void> {
    await this.init();
    const db = await getDatabase();
    db.prepare(`DELETE FROM knowledge_edges WHERE source_id = ? OR target_id = ?`).run(id, id);
    db.prepare(`DELETE FROM knowledge_nodes WHERE id = ?`).run(id);
    logger.debug(`Deleted knowledge node: ${id}`);
  }

  // ── Edge operations ──

  /**
   * Create an edge between two nodes.
   */
  public async addEdge(edge: Omit<KnowledgeEdge, 'id' | 'createdAt'>): Promise<KnowledgeEdge> {
    await this.init();
    const db = await getDatabase();
    const id = `edge-${edge.sourceId}-${edge.targetId}-${edge.relationship}-${Date.now()}`;
    const now = new Date().toISOString();

    const result: KnowledgeEdge = { ...edge, id, createdAt: now };

    db.prepare(`
      INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      result.id, result.sourceId, result.targetId, result.relationship,
      result.weight ?? 1.0,
      result.metadata ? JSON.stringify(result.metadata) : null,
      result.createdAt
    );

    logger.debug(`Added knowledge edge: ${result.id} (${result.sourceId} -[${result.relationship}]-> ${result.targetId})`);
    return result;
  }

  /**
   * Get all edges connected to a node (both inbound and outbound).
   */
  public async getEdges(nodeId: string, direction?: 'inbound' | 'outbound'): Promise<KnowledgeEdge[]> {
    await this.init();
    const db = await getDatabase();

    let sql: string;
    let rows: any[];

    if (direction === 'inbound') {
      rows = db.prepare(`SELECT * FROM knowledge_edges WHERE target_id = ?`).all(nodeId) as any[];
    } else if (direction === 'outbound') {
      rows = db.prepare(`SELECT * FROM knowledge_edges WHERE source_id = ?`).all(nodeId) as any[];
    } else {
      rows = db.prepare(`SELECT * FROM knowledge_edges WHERE source_id = ? OR target_id = ?`).all(nodeId, nodeId) as any[];
    }

    return rows.map(r => this.rowToEdge(r));
  }

  /**
   * Delete an edge.
   */
  public async deleteEdge(id: string): Promise<void> {
    await this.init();
    const db = await getDatabase();
    db.prepare(`DELETE FROM knowledge_edges WHERE id = ?`).run(id);
  }

  // ── Traversal ──

  /**
   * BFS traversal from a starting node, up to maxDepth hops.
   */
  public async traverse(startNodeId: string, maxDepth: number = 3): Promise<TraversalResult[]> {
    await this.init();
    const results: TraversalResult[] = [];
    const visited = new Set<string>();
    let frontier = [startNodeId];

    for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth++) {
      const nextFrontier: string[] = [];

      for (const nodeId of frontier) {
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const node = await this.getNode(nodeId);
        if (!node) continue;

        const edges = await this.getEdges(nodeId);
        results.push({ node, edges, depth });

        for (const edge of edges) {
          const neighbor = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
          if (!visited.has(neighbor)) nextFrontier.push(neighbor);
        }
      }

      frontier = nextFrontier;
    }

    return results;
  }

  /**
   * Find the shortest path between two nodes (BFS).
   */
  public async shortestPath(fromId: string, toId: string): Promise<KnowledgeEdge[] | null> {
    await this.init();

    if (fromId === toId) return [];

    const visited = new Set<string>();
    const parent = new Map<string, { nodeId: string; edge: KnowledgeEdge }>();
    const queue = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = await this.getEdges(current);

      for (const edge of edges) {
        const neighbor = edge.sourceId === current ? edge.targetId : edge.sourceId;

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, { nodeId: current, edge });

          if (neighbor === toId) {
            const path: KnowledgeEdge[] = [];
            let step = neighbor;
            while (step !== fromId) {
              const p = parent.get(step)!;
              path.unshift(p.edge);
              step = p.nodeId;
            }
            return path;
          }

          queue.push(neighbor);
        }
      }
    }

    return null;
  }

  // ── Statistics ──

  /**
   * Get knowledge graph statistics.
   */
  public async getStats(): Promise<{
    totalNodes: number;
    totalEdges: number;
    byType: Record<string, number>;
    byRelationship: Record<string, number>;
  }> {
    await this.init();
    const db = await getDatabase();

    const nodeRow = db.prepare(`SELECT COUNT(*) as c FROM knowledge_nodes`).get() as any;
    const edgeRow = db.prepare(`SELECT COUNT(*) as c FROM knowledge_edges`).get() as any;
    const typeRows = db.prepare(`SELECT type, COUNT(*) as c FROM knowledge_nodes GROUP BY type`).all() as any[];
    const relRows = db.prepare(`SELECT relationship, COUNT(*) as c FROM knowledge_edges GROUP BY relationship`).all() as any[];

    const byType: Record<string, number> = {};
    for (const r of typeRows) byType[r.type] = r.c;

    const byRelationship: Record<string, number> = {};
    for (const r of relRows) byRelationship[r.relationship] = r.c;

    return {
      totalNodes: nodeRow?.c || 0,
      totalEdges: edgeRow?.c || 0,
      byType,
      byRelationship,
    };
  }

  /**
   * Clear the entire knowledge graph.
   */
  public async reset(): Promise<void> {
    await this.init();
    const db = await getDatabase();
    db.prepare(`DELETE FROM knowledge_edges`).run();
    db.prepare(`DELETE FROM knowledge_nodes`).run();
    logger.info('Knowledge Graph reset — all nodes and edges cleared.');
  }

  // ── Private helpers ──

  private rowToNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      type: row.type,
      label: row.label,
      description: row.description || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToEdge(row: any): KnowledgeEdge {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      relationship: row.relationship,
      weight: row.weight,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
    };
  }
}
