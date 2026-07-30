export interface KnowledgeNode {
    id: string;
    type: 'entity' | 'concept' | 'document' | 'tool' | 'domain';
    label: string;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}
export interface KnowledgeEdge {
    id: string;
    sourceId: string;
    targetId: string;
    relationship: string;
    weight?: number;
    metadata?: Record<string, any>;
    createdAt: string;
}
export interface TraversalResult {
    node: KnowledgeNode;
    edges: KnowledgeEdge[];
    depth: number;
}
export declare class KnowledgeGraph {
    private initialized;
    /**
     * Create the knowledge graph tables in SQLite.
     */
    init(): Promise<void>;
    /**
     * Upsert a knowledge node.
     */
    upsertNode(node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt'> & {
        createdAt?: string;
        updatedAt?: string;
    }): Promise<KnowledgeNode>;
    /**
     * Get a node by ID.
     */
    getNode(id: string): Promise<KnowledgeNode | null>;
    /**
     * Search nodes by label or description (SQL LIKE).
     */
    searchNodes(query: string, type?: KnowledgeNode['type']): Promise<KnowledgeNode[]>;
    /**
     * List all nodes of a given type.
     */
    listNodes(type?: KnowledgeNode['type']): Promise<KnowledgeNode[]>;
    /**
     * Delete a node and all its edges.
     */
    deleteNode(id: string): Promise<void>;
    /**
     * Create an edge between two nodes.
     */
    addEdge(edge: Omit<KnowledgeEdge, 'id' | 'createdAt'>): Promise<KnowledgeEdge>;
    /**
     * Get all edges connected to a node (both inbound and outbound).
     */
    getEdges(nodeId: string, direction?: 'inbound' | 'outbound'): Promise<KnowledgeEdge[]>;
    /**
     * Delete an edge.
     */
    deleteEdge(id: string): Promise<void>;
    /**
     * BFS traversal from a starting node, up to maxDepth hops.
     */
    traverse(startNodeId: string, maxDepth?: number): Promise<TraversalResult[]>;
    /**
     * Find the shortest path between two nodes (BFS).
     */
    shortestPath(fromId: string, toId: string): Promise<KnowledgeEdge[] | null>;
    /**
     * Get knowledge graph statistics.
     */
    getStats(): Promise<{
        totalNodes: number;
        totalEdges: number;
        byType: Record<string, number>;
        byRelationship: Record<string, number>;
    }>;
    /**
     * Clear the entire knowledge graph.
     */
    reset(): Promise<void>;
    private rowToNode;
    private rowToEdge;
}
//# sourceMappingURL=knowledge-graph.d.ts.map