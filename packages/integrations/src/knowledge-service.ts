import { createLogger } from '@ai-agent-platform/shared';
import {
  EmbeddingGenerator,
  LocalEmbeddingGenerator,
  MockEmbeddingGenerator,
  cosineSimilarity,
} from '@ai-agent-platform/ai';
import { getTursoClient, isTursoConfigured } from './turso.js';

const logger = createLogger('KnowledgeService');

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string;
  tags: string[];
  summary?: string;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  source: string;
  category: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  tokenEstimate: number;
  tags: string[];
}

export interface KnowledgeSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  source: string;
  category: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export interface IngestDocumentInput {
  id?: string;
  title: string;
  content: string;
  source?: string;
  category?: string;
  tags?: string[];
  summary?: string;
}

export interface SearchKnowledgeOptions {
  limit?: number;
  category?: string;
  sourceFilter?: string;
  minScore?: number;
}

/**
 * Splits text into overlapping chunks using paragraph, header, or sentence boundaries.
 */
export function chunkDocumentText(
  text: string,
  options: { maxChunkSize?: number; overlap?: number } = {}
): string[] {
  const maxChunkSize = options.maxChunkSize ?? 600;
  const overlap = options.overlap ?? 100;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxChunkSize) {
    return [clean];
  }

  // Split by markdown headers or double newlines first
  const sections = clean.split(/(?=\n#{1,4}\s)|\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 2 <= maxChunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If single section exceeds maxChunkSize, split by sentences or line breaks
      if (trimmed.length > maxChunkSize) {
        const sentences = trimmed.split(/(?<=[.?!])\s+|\n+/);
        let subChunk = '';
        for (const sent of sentences) {
          if (subChunk.length + sent.length + 1 <= maxChunkSize) {
            subChunk = subChunk ? `${subChunk} ${sent}` : sent;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = sent;
          }
        }
        if (subChunk) {
          currentChunk = subChunk;
        } else {
          currentChunk = '';
        }
      } else {
        // Carry over overlap if available
        if (overlap > 0 && currentChunk.length > overlap) {
          const overlapTail = currentChunk.slice(-overlap);
          currentChunk = `${overlapTail}\n${trimmed}`;
        } else {
          currentChunk = trimmed;
        }
      }
    }
  }

  if (currentChunk && !chunks.includes(currentChunk)) {
    chunks.push(currentChunk);
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * KnowledgeService
 * Core engine for document ingestion, chunking, embedding generation,
 * persistent storage, and hybrid retrieval-augmented generation.
 */
export class KnowledgeService {
  private documents = new Map<string, KnowledgeDocument>();
  private chunks = new Map<string, KnowledgeChunk>();
  private embedder: EmbeddingGenerator;
  private tableReady = false;
  private useMemoryFallback = false;
  private initialized = false;

  constructor(embedder?: EmbeddingGenerator) {
    this.embedder = embedder ?? new LocalEmbeddingGenerator('Xenova/all-MiniLM-L6-v2');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    if (!isTursoConfigured()) {
      this.useMemoryFallback = true;
      this.tableReady = true;
      logger.info('KnowledgeService using in-memory store (no Turso credentials configured)');
      this.seedDefaultKnowledge();
      this.initialized = true;
      return;
    }

    try {
      const client = getTursoClient();
      await client.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL,
          category TEXT NOT NULL,
          tags TEXT,
          summary TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          chunk_count INTEGER DEFAULT 0
        );
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          document_title TEXT NOT NULL,
          source TEXT NOT NULL,
          category TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          content TEXT NOT NULL,
          embedding_json TEXT,
          token_estimate INTEGER DEFAULT 0,
          tags TEXT
        );
      `);

      this.tableReady = true;
      logger.info('KnowledgeService Turso tables ready');
      await this.loadFromTurso();
    } catch (err: any) {
      logger.warn(`KnowledgeService Turso init failed (${err?.message ?? err}), using in-memory fallback`);
      this.useMemoryFallback = true;
    }

    if (this.documents.size === 0) {
      this.seedDefaultKnowledge();
    }

    this.initialized = true;
  }

  private async loadFromTurso(): Promise<void> {
    try {
      const client = getTursoClient();
      const docRows = await client.execute('SELECT * FROM knowledge_documents');
      for (const row of docRows.rows as any[]) {
        const doc: KnowledgeDocument = {
          id: String(row.id),
          title: String(row.title),
          content: String(row.content),
          source: String(row.source),
          category: String(row.category),
          tags: row.tags ? JSON.parse(String(row.tags)) : [],
          summary: row.summary ? String(row.summary) : undefined,
          createdAt: String(row.created_at),
          updatedAt: String(row.updated_at),
          chunkCount: Number(row.chunk_count || 0),
        };
        this.documents.set(doc.id, doc);
      }

      const chunkRows = await client.execute('SELECT * FROM knowledge_chunks');
      for (const row of chunkRows.rows as any[]) {
        const chunk: KnowledgeChunk = {
          id: String(row.id),
          documentId: String(row.document_id),
          documentTitle: String(row.document_title),
          source: String(row.source),
          category: String(row.category),
          chunkIndex: Number(row.chunk_index),
          content: String(row.content),
          embedding: row.embedding_json ? JSON.parse(String(row.embedding_json)) : undefined,
          tokenEstimate: Number(row.token_estimate || 0),
          tags: row.tags ? JSON.parse(String(row.tags)) : [],
        };
        this.chunks.set(chunk.id, chunk);
      }
    } catch (err: any) {
      logger.warn(`Could not load existing knowledge from Turso: ${err?.message ?? err}`);
    }
  }

  /**
   * Seeds foundational project documentation for out-of-the-box RAG queries.
   */
  private seedDefaultKnowledge(): void {
    const defaultDocs: IngestDocumentInput[] = [
      {
        id: 'doc-auth-architecture',
        title: 'Authentication & Discord Gateway Specification',
        category: 'authentication',
        source: 'docs/architecture/authentication-gateway.md',
        tags: ['auth', 'discord', 'gateway', 'dm', 'tokens', 'security'],
        summary: 'Detailed architecture for Discord gateway event handling, Direct Message routing, token management, and secure session isolation.',
        content: `
# Authentication & Discord Gateway Specification

## 1. Authentication & Token Management
The Umakraft Discord platform uses scoped bot tokens and API keys configured strictly via server environment variables:
- DISCORD_TOKEN: Used to authenticate the Discord WebSocket Gateway client.
- OPENAI_API_KEY / GROQ_API_KEY: Used for LLM inference and embedding generation.
- TURSO_DATABASE_URL & TURSO_AUTH_TOKEN: Used for LibSQL database storage.

## 2. Direct Message (DM) Handling
Direct Messages are intercepted by the Discord messageCreate handler and identified via message.channel.isDMBased().
- DM channels are isolated using deterministic conversation keys formatted as 'discord-dm:<userId>'.
- All user context is partitioned by Discord author ID (message.author.id) to guarantee zero cross-talk between different users.
- Bot self-replies and system webhook messages are strictly dropped to prevent recursive loops.

## 3. Security & Domain Boundaries
- Tools executed by the agent are validated against the ToolRegistry schema.
- Unregistered tools or invalid parameter inputs are rejected before execution.
`.trim(),
      },
      {
        id: 'doc-system-architecture',
        title: 'Umakraft Platform Final Architecture Specification',
        category: 'architecture',
        source: 'docs/architecture/final-architecture.md',
        tags: ['architecture', 'engine', 'layers', 'dag', 'scheduler', 'turborepo'],
        summary: 'Specification of the asynchronous layer-by-layer execution engine, DAG scheduler, and modular Turborepo architecture.',
        content: `
# Umakraft Platform Final Architecture Specification

## 1. Topological Layer Scheduling
The platform schedules agent execution into mathematically verified topological layers:
- Parallel independent tasks execute concurrently within the same layer.
- Downstream dependent tasks run strictly after upstream prerequisite layers complete.
- Cycle detection is performed using Kahn's algorithm before DAG execution begins.

## 2. Core Packages & Directory Structure
- packages/core: Implements ToolCallingAgent, ToolRegistry, and layer scheduling algorithms.
- packages/ai: Houses LLM providers (OpenAI, Groq), token budgeting, and embedding generators.
- packages/integrations: Provides memory services, Turso LibSQL persistence, and knowledge retrieval.
- apps/discord: Implements the Discord bot gateway, slash commands (/ask, /chat), and zero-keyword DM router.
`.trim(),
      },
      {
        id: 'doc-deployment-infra',
        title: 'Deployment Architecture & Cloud Run Infrastructure',
        category: 'deployment',
        source: 'docs/architecture/deployment-infrastructure.md',
        tags: ['deployment', 'cloud-run', 'docker', 'nginx', 'production', 'port-3000'],
        summary: 'Cloud Run production container setup, port 3000 reverse proxy configuration, and persistent storage guarantees.',
        content: `
# Deployment Architecture & Production Infrastructure

## 1. Container & Reverse Proxy Setup
The application is deployed to Google Cloud Run containers managed behind an Nginx reverse proxy:
- External traffic is routed exclusively through Port 3000.
- The dev and production server runs on port 3000 using Node.js TypeScript execution (node --loader tsx server.ts).
- Client SPAs build static bundles into dist/ served via Express static handlers.

## 2. Persistence & High Availability
- Durable cloud persistence uses Turso LibSQL distributed database across regions.
- When Turso credentials are not configured, an automatic in-memory fallback guarantees high availability without crashing.
- Multi-turn conversation sessions and user memories survive application restarts.
`.trim(),
      },
      {
        id: 'doc-training-domain',
        title: 'Umamusume Domain & Training Strategy Reference',
        category: 'domain',
        source: 'docs/domain/umamusume-strategy.md',
        tags: ['umamusume', 'training', 'stamina', 'speed', 'skills', 'ura-finals'],
        summary: 'Domain reference for character stats, race distance tactics, skill synergy, and URA Finals preparation.',
        content: `
# Umamusume Domain & Training Strategy Reference

## 1. Stat Balancing by Race Distance
- Sprint / Mile: Emphasize Speed (A/S) and Power (B+) with moderate Stamina (C).
- Medium / Long Distance: Stamina (A/S) and Recovery skills (e.g. Maestro, Blue Skills) are mandatory to prevent stamina depletion in late race stretches.

## 2. Race Tactics & Positioning
- Runner (Nige): Needs high Speed and early positioning skills to secure the lead.
- Leader (Senkou): Balanced Speed and Power with late-surge acceleration.
- Betweener (Sashi) & Chaser (Oikomi): High Power and late-race passing skills to burst from the back pack.
`.trim(),
      },
    ];

    for (const doc of defaultDocs) {
      const docId = doc.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const chunks = chunkDocumentText(doc.content);
      const now = new Date().toISOString();

      const fullDoc: KnowledgeDocument = {
        id: docId,
        title: doc.title,
        content: doc.content,
        source: doc.source || 'internal:seed',
        category: doc.category || 'general',
        tags: doc.tags || [],
        summary: doc.summary,
        createdAt: now,
        updatedAt: now,
        chunkCount: chunks.length,
      };

      this.documents.set(docId, fullDoc);

      chunks.forEach((chunkContent, idx) => {
        const chunkId = `${docId}-chunk-${idx}`;
        this.chunks.set(chunkId, {
          id: chunkId,
          documentId: docId,
          documentTitle: doc.title,
          source: fullDoc.source,
          category: fullDoc.category,
          chunkIndex: idx,
          content: chunkContent,
          tokenEstimate: Math.ceil(chunkContent.length / 4),
          tags: fullDoc.tags,
        });
      });
    }

    logger.info(`Seeded ${this.documents.size} default knowledge documents (${this.chunks.size} chunks)`);
  }

  /**
   * Ingests a new document into the knowledge base, splits into chunks, and computes embeddings.
   */
  public async ingestDocument(input: IngestDocumentInput): Promise<KnowledgeDocument> {
    await this.ensureInitialized();

    const docId = input.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const chunksText = chunkDocumentText(input.content);

    const doc: KnowledgeDocument = {
      id: docId,
      title: input.title.trim(),
      content: input.content.trim(),
      source: input.source || 'user:uploaded',
      category: (input.category || 'general').toLowerCase(),
      tags: input.tags || [],
      summary: input.summary,
      createdAt: now,
      updatedAt: now,
      chunkCount: chunksText.length,
    };

    this.documents.set(docId, doc);

    // Compute embeddings for all chunks in batch
    let embeddings: number[][] = [];
    try {
      const embedResults = await this.embedder.embedBatch(chunksText);
      embeddings = embedResults.map((r) => r.embedding);
    } catch (err: any) {
      logger.warn(`Failed to generate embeddings for document ${docId} (${err?.message ?? err}), using lexical search`);
    }

    const createdChunks: KnowledgeChunk[] = [];
    for (let idx = 0; idx < chunksText.length; idx++) {
      const chunkText = chunksText[idx];
      const chunkId = `${docId}-chunk-${idx}`;
      const chunk: KnowledgeChunk = {
        id: chunkId,
        documentId: docId,
        documentTitle: doc.title,
        source: doc.source,
        category: doc.category,
        chunkIndex: idx,
        content: chunkText,
        embedding: embeddings[idx],
        tokenEstimate: Math.ceil(chunkText.length / 4),
        tags: doc.tags,
      };
      this.chunks.set(chunkId, chunk);
      createdChunks.push(chunk);
    }

    // Persist to Turso if configured
    if (!this.useMemoryFallback && isTursoConfigured()) {
      try {
        const client = getTursoClient();
        await client.execute({
          sql: `INSERT OR REPLACE INTO knowledge_documents (id, title, content, source, category, tags, summary, created_at, updated_at, chunk_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            doc.id,
            doc.title,
            doc.content,
            doc.source,
            doc.category,
            JSON.stringify(doc.tags),
            doc.summary ?? null,
            doc.createdAt,
            doc.updatedAt,
            doc.chunkCount,
          ],
        });

        for (const chunk of createdChunks) {
          await client.execute({
            sql: `INSERT OR REPLACE INTO knowledge_chunks (id, document_id, document_title, source, category, chunk_index, content, embedding_json, token_estimate, tags)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              chunk.id,
              chunk.documentId,
              chunk.documentTitle,
              chunk.source,
              chunk.category,
              chunk.chunkIndex,
              chunk.content,
              chunk.embedding ? JSON.stringify(chunk.embedding) : null,
              chunk.tokenEstimate,
              JSON.stringify(chunk.tags),
            ],
          });
        }
      } catch (err: any) {
        logger.warn(`Failed to persist document ${docId} to Turso: ${err?.message ?? err}`);
      }
    }

    logger.info(`[KnowledgeService] Ingested document "${doc.title}" (${doc.chunkCount} chunks)`);
    return doc;
  }

  /**
   * Hybrid search: Combines vector cosine similarity with lexical keyword overlap.
   */
  public async search(query: string, options: SearchKnowledgeOptions = {}): Promise<KnowledgeSearchResult[]> {
    await this.ensureInitialized();

    const limit = options.limit ?? 4;
    const minScore = options.minScore ?? 0.25;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];

    const queryKeywords = cleanQuery
      .split(/\W+/)
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());

    // Generate query embedding
    let queryEmbedding: number[] | null = null;
    try {
      const res = await this.embedder.embed(query);
      queryEmbedding = res.embedding;
    } catch (err: any) {
      logger.warn(`Could not embed query (${err?.message ?? err}), falling back to lexical search`);
    }

    const scoredResults: KnowledgeSearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (options.category && chunk.category.toLowerCase() !== options.category.toLowerCase()) {
        continue;
      }
      if (options.sourceFilter && !chunk.source.toLowerCase().includes(options.sourceFilter.toLowerCase())) {
        continue;
      }

      // 1. Vector similarity score
      let vectorScore = 0;
      if (queryEmbedding && chunk.embedding && queryEmbedding.length === chunk.embedding.length) {
        try {
          vectorScore = Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding));
        } catch {
          vectorScore = 0;
        }
      }

      // 2. Lexical keyword score
      const chunkLower = chunk.content.toLowerCase();
      const titleLower = chunk.documentTitle.toLowerCase();
      let keywordHits = 0;

      for (const kw of queryKeywords) {
        if (titleLower.includes(kw)) keywordHits += 2.5;
        if (chunkLower.includes(kw)) keywordHits += 1.0;
        if (chunk.tags.some((t) => t.toLowerCase().includes(kw))) keywordHits += 1.5;
      }

      const lexicalScore = queryKeywords.length > 0 ? Math.min(1.0, keywordHits / (queryKeywords.length * 1.5)) : 0;

      // Combined hybrid score (70% vector + 30% lexical if vector present, else 100% lexical)
      const combinedScore = queryEmbedding && chunk.embedding ? vectorScore * 0.65 + lexicalScore * 0.35 : lexicalScore;

      if (combinedScore >= minScore) {
        scoredResults.push({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          source: chunk.source,
          category: chunk.category,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: combinedScore,
        });
      }
    }

    // Sort descending by relevance score
    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  }

  /**
   * Retrieves a document by exact ID or matching title.
   */
  public async getDocument(idOrTitle: string): Promise<KnowledgeDocument | null> {
    await this.ensureInitialized();
    const query = idOrTitle.trim();
    if (this.documents.has(query)) {
      return this.documents.get(query)!;
    }

    const queryLower = query.toLowerCase();
    for (const doc of this.documents.values()) {
      if (doc.title.toLowerCase().includes(queryLower) || doc.id.toLowerCase() === queryLower) {
        return doc;
      }
    }
    return null;
  }

  /**
   * Lists all indexed documents and sources.
   */
  public async listSources(category?: string): Promise<
    Array<{
      id: string;
      title: string;
      source: string;
      category: string;
      tags: string[];
      chunkCount: number;
      updatedAt: string;
    }>
  > {
    await this.ensureInitialized();
    const list = Array.from(this.documents.values());
    const filtered = category
      ? list.filter((d) => d.category.toLowerCase() === category.toLowerCase())
      : list;

    return filtered.map((d) => ({
      id: d.id,
      title: d.title,
      source: d.source,
      category: d.category,
      tags: d.tags,
      chunkCount: d.chunkCount,
      updatedAt: d.updatedAt,
    }));
  }

  /**
   * Summarizes an indexed document.
   */
  public async summarizeDocument(
    idOrTitle: string
  ): Promise<{ documentId: string; title: string; summary: string; source: string }> {
    const doc = await this.getDocument(idOrTitle);
    if (!doc) {
      throw new Error(`Document not found matching "${idOrTitle}"`);
    }

    if (doc.summary) {
      return {
        documentId: doc.id,
        title: doc.title,
        summary: doc.summary,
        source: doc.source,
      };
    }

    // Generate extractive summary if no precomputed summary exists
    const chunks = Array.from(this.chunks.values())
      .filter((c) => c.documentId === doc.id)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const firstTwoChunks = chunks.slice(0, 2).map((c) => c.content).join('\n\n');
    const summary = firstTwoChunks.length > 350 ? `${firstTwoChunks.slice(0, 350)}...` : firstTwoChunks;

    return {
      documentId: doc.id,
      title: doc.title,
      summary,
      source: doc.source,
    };
  }

  /**
   * Formats retrieved knowledge chunks into prompt-ready context with citations.
   */
  public formatContextForPrompt(results: KnowledgeSearchResult[]): string {
    if (results.length === 0) {
      return '';
    }

    const lines: string[] = [
      '══ Grounded Knowledge Base Context (Retrieved via RAG) ══',
      'Rules:',
      '- Use the following retrieved facts as your primary source of truth.',
      '- Attribute your answers to the source documents when answering.',
      '- If the requested information is not present in the context, explicitly state that it is not documented.',
      '',
    ];

    results.forEach((res, i) => {
      lines.push(
        `[Document ${i + 1}: ${res.documentTitle} | Source: ${res.source} | Score: ${res.score.toFixed(2)}]`
      );
      lines.push(res.content.trim());
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════════════════════');
    return lines.join('\n');
  }

  /**
   * Clears all knowledge documents and chunks (for testing).
   */
  public async clear(reseed = false): Promise<void> {
    this.documents.clear();
    this.chunks.clear();
    this.initialized = true;
    if (reseed) {
      this.seedDefaultKnowledge();
    }
  }
}

export const knowledgeService = new KnowledgeService();
