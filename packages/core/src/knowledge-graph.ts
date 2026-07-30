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
    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS knowledge_nodes (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `, (err) => { if (err) return reject(err); });

        db.run(`
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
        `, (err) => { if (err) return reject(err); });

        db.run(`
          CREATE INDEX IF NOT EXISTS idx_edges_source ON knowledge_edges(source_id);
        `, (err) => { if (err) return reject(err); });
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_edges_target ON knowledge_edges(target_id);
        `, (err) => { if (err) return reject(err); });
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_nodes_type ON knowledge_nodes(type);
        `, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

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

    await new Promise<void>((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO knowledge_nodes (id, type, label, description, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          label = excluded.label,
          description = excluded.description,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `);
      stmt.run(
        result.id, result.type, result.label,
        result.description || null,
        result.metadata ? JSON.stringify(result.metadata) : null,
        result.createdAt, result.updatedAt,
        (err: Error | null) => {
          stmt.finalize();
          if (err) return reject(err);
          resolve();
        }
      );
    });

    logger.debug(`Upserted knowledge node: ${node.id} (${node.type}: ${node.label})`);
    return result;
  }

  /**
   * Get a node by ID.
   */
  public async getNode(id: string): Promise<KnowledgeNode | null> {
    await this.init();
    const db = await getDatabase();

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT * FROM knowledge_nodes WHERE id = ?`,
        [id],
        (err: Error | null, rows: any[]) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });

    if (rows.length === 0) return null;
    return this.rowToNode(rows[0]);
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

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

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

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    return rows.map(r => this.rowToNode(r));
  }

  /**
   * Delete a node and all its edges.
   */
  public async deleteNode(id: string): Promise<void> {
    await this.init();
    const db = await getDatabase();

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`DELETE FROM knowledge_edges WHERE source_id = ? OR target_id = ?`, [id, id], (err) => {
          if (err) return reject(err);
        });
        db.run(`DELETE FROM knowledge_nodes WHERE id = ?`, [id], (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

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

    const result: KnowledgeEdge = {
      ...edge,
      id,
      createdAt: now,
    };

    await new Promise<void>((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        result.id, result.sourceId, result.targetId, result.relationship,
        result.weight ?? 1.0,
        result.metadata ? JSON.stringify(result.metadata) : null,
        result.createdAt,
        (err: Error | null) => {
          stmt.finalize();
          if (err) return reject(err);
          resolve();
        }
      );
    });

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
    const params: any[] = [];

    if (direction === 'inbound') {
      sql = `SELECT * FROM knowledge_edges WHERE target_id = ?`;
    } else if (direction === 'outbound') {
      sql = `SELECT * FROM knowledge_edges WHERE source_id = ?`;
    } else {
      sql = `SELECT * FROM knowledge_edges WHERE source_id = ? OR target_id = ?`;
      params.push(nodeId);
    }

    params.unshift(nodeId);

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });

    return rows.map(r => this.rowToEdge(r));
  }

  /**
   * Delete an edge.
   */
  public async deleteEdge(id: string): Promise<void> {
    await this.init();
    const db = await getDatabase();

    await new Promise<void>((resolve, reject) => {
      db.run(`DELETE FROM knowledge_edges WHERE id = ?`, [id], (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
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

        // Enqueue neighbors
        for (const edge of edges) {
          const neighbor = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
          if (!visited.has(neighbor)) {
            nextFrontier.push(neighbor);
          }
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
            // Reconstruct path
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

    return null; // no path found
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

    const [nodeRows, edgeRows, typeRows, relRows] = await Promise.all([
      new Promise<any[]>((res, rej) => db.all(`SELECT COUNT(*) as c FROM knowledge_nodes`, (e, r) => e ? rej(e) : res(r || []))),
      new Promise<any[]>((res, rej) => db.all(`SELECT COUNT(*) as c FROM knowledge_edges`, (e, r) => e ? rej(e) : res(r || []))),
      new Promise<any[]>((res, rej) => db.all(`SELECT type, COUNT(*) as c FROM knowledge_nodes GROUP BY type`, (e, r) => e ? rej(e) : res(r || []))),
      new Promise<any[]>((res, rej) => db.all(`SELECT relationship, COUNT(*) as c FROM knowledge_edges GROUP BY relationship`, (e, r) => e ? rej(e) : res(r || []))),
    ]);

    const byType: Record<string, number> = {};
    for (const r of typeRows) byType[r.type] = r.c;

    const byRelationship: Record<string, number> = {};
    for (const r of relRows) byRelationship[r.relationship] = r.c;

    return {
      totalNodes: nodeRows[0]?.c || 0,
      totalEdges: edgeRows[0]?.c || 0,
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

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        db.run(`DELETE FROM knowledge_edges`);
        db.run(`DELETE FROM knowledge_nodes`, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });

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
