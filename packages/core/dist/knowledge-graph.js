import { createLogger } from '@ai-agent-platform/shared';
import { getDatabase } from '@ai-agent-platform/integrations';
const logger = createLogger('KnowledgeGraph');
// ── KnowledgeGraph ──
export class KnowledgeGraph {
    initialized = false;
    /**
     * Create the knowledge graph tables in SQLite.
     */
    async init() {
        if (this.initialized)
            return;
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
    async upsertNode(node) {
        await this.init();
        const db = await getDatabase();
        const now = new Date().toISOString();
        const result = {
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
    `).run(result.id, result.type, result.label, result.description || null, result.metadata ? JSON.stringify(result.metadata) : null, result.createdAt, result.updatedAt);
        logger.debug(`Upserted knowledge node: ${node.id} (${node.type}: ${node.label})`);
        return result;
    }
    /**
     * Get a node by ID.
     */
    async getNode(id) {
        await this.init();
        const db = await getDatabase();
        const row = db.prepare(`SELECT * FROM knowledge_nodes WHERE id = ?`).get(id);
        if (!row)
            return null;
        return this.rowToNode(row);
    }
    /**
     * Search nodes by label or description (SQL LIKE).
     */
    async searchNodes(query, type) {
        await this.init();
        const db = await getDatabase();
        let sql = `SELECT * FROM knowledge_nodes WHERE (label LIKE ? OR description LIKE ?)`;
        const params = [`%${query}%`, `%${query}%`];
        if (type) {
            sql += ` AND type = ?`;
            params.push(type);
        }
        sql += ` ORDER BY updated_at DESC LIMIT 50`;
        const rows = db.prepare(sql).all(...params);
        return rows.map(r => this.rowToNode(r));
    }
    /**
     * List all nodes of a given type.
     */
    async listNodes(type) {
        await this.init();
        const db = await getDatabase();
        let sql = `SELECT * FROM knowledge_nodes`;
        const params = [];
        if (type) {
            sql += ` WHERE type = ?`;
            params.push(type);
        }
        sql += ` ORDER BY updated_at DESC`;
        const rows = db.prepare(sql).all(...params);
        return rows.map(r => this.rowToNode(r));
    }
    /**
     * Delete a node and all its edges.
     */
    async deleteNode(id) {
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
    async addEdge(edge) {
        await this.init();
        const db = await getDatabase();
        const id = `edge-${edge.sourceId}-${edge.targetId}-${edge.relationship}-${Date.now()}`;
        const now = new Date().toISOString();
        const result = { ...edge, id, createdAt: now };
        db.prepare(`
      INSERT INTO knowledge_edges (id, source_id, target_id, relationship, weight, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(result.id, result.sourceId, result.targetId, result.relationship, result.weight ?? 1.0, result.metadata ? JSON.stringify(result.metadata) : null, result.createdAt);
        logger.debug(`Added knowledge edge: ${result.id} (${result.sourceId} -[${result.relationship}]-> ${result.targetId})`);
        return result;
    }
    /**
     * Get all edges connected to a node (both inbound and outbound).
     */
    async getEdges(nodeId, direction) {
        await this.init();
        const db = await getDatabase();
        let sql;
        let rows;
        if (direction === 'inbound') {
            rows = db.prepare(`SELECT * FROM knowledge_edges WHERE target_id = ?`).all(nodeId);
        }
        else if (direction === 'outbound') {
            rows = db.prepare(`SELECT * FROM knowledge_edges WHERE source_id = ?`).all(nodeId);
        }
        else {
            rows = db.prepare(`SELECT * FROM knowledge_edges WHERE source_id = ? OR target_id = ?`).all(nodeId, nodeId);
        }
        return rows.map(r => this.rowToEdge(r));
    }
    /**
     * Delete an edge.
     */
    async deleteEdge(id) {
        await this.init();
        const db = await getDatabase();
        db.prepare(`DELETE FROM knowledge_edges WHERE id = ?`).run(id);
    }
    // ── Traversal ──
    /**
     * BFS traversal from a starting node, up to maxDepth hops.
     */
    async traverse(startNodeId, maxDepth = 3) {
        await this.init();
        const results = [];
        const visited = new Set();
        let frontier = [startNodeId];
        for (let depth = 0; depth <= maxDepth && frontier.length > 0; depth++) {
            const nextFrontier = [];
            for (const nodeId of frontier) {
                if (visited.has(nodeId))
                    continue;
                visited.add(nodeId);
                const node = await this.getNode(nodeId);
                if (!node)
                    continue;
                const edges = await this.getEdges(nodeId);
                results.push({ node, edges, depth });
                for (const edge of edges) {
                    const neighbor = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
                    if (!visited.has(neighbor))
                        nextFrontier.push(neighbor);
                }
            }
            frontier = nextFrontier;
        }
        return results;
    }
    /**
     * Find the shortest path between two nodes (BFS).
     */
    async shortestPath(fromId, toId) {
        await this.init();
        if (fromId === toId)
            return [];
        const visited = new Set();
        const parent = new Map();
        const queue = [fromId];
        visited.add(fromId);
        while (queue.length > 0) {
            const current = queue.shift();
            const edges = await this.getEdges(current);
            for (const edge of edges) {
                const neighbor = edge.sourceId === current ? edge.targetId : edge.sourceId;
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parent.set(neighbor, { nodeId: current, edge });
                    if (neighbor === toId) {
                        const path = [];
                        let step = neighbor;
                        while (step !== fromId) {
                            const p = parent.get(step);
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
    async getStats() {
        await this.init();
        const db = await getDatabase();
        const nodeRow = db.prepare(`SELECT COUNT(*) as c FROM knowledge_nodes`).get();
        const edgeRow = db.prepare(`SELECT COUNT(*) as c FROM knowledge_edges`).get();
        const typeRows = db.prepare(`SELECT type, COUNT(*) as c FROM knowledge_nodes GROUP BY type`).all();
        const relRows = db.prepare(`SELECT relationship, COUNT(*) as c FROM knowledge_edges GROUP BY relationship`).all();
        const byType = {};
        for (const r of typeRows)
            byType[r.type] = r.c;
        const byRelationship = {};
        for (const r of relRows)
            byRelationship[r.relationship] = r.c;
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
    async reset() {
        await this.init();
        const db = await getDatabase();
        db.prepare(`DELETE FROM knowledge_edges`).run();
        db.prepare(`DELETE FROM knowledge_nodes`).run();
        logger.info('Knowledge Graph reset — all nodes and edges cleared.');
    }
    // ── Private helpers ──
    rowToNode(row) {
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
    rowToEdge(row) {
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
//# sourceMappingURL=knowledge-graph.js.map