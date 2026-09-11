import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { knowledgeService } from './knowledge-service.js';

const logger = createLogger('KnowledgeTools');

/**
 * Tool 1: search_knowledge
 * Semantic & keyword search over project documents, uploaded files, and stored knowledge.
 */
export const searchKnowledgeTool: ToolDefinition = {
  slug: 'search_knowledge',
  name: 'Search Knowledge Base',
  description: 'Searches project documents, uploaded files, architectural specifications, and internal knowledge using hybrid vector retrieval. Use when the user asks questions about project docs, architecture, deployment, authentication, or stored specifications.',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query or topic to search within project documents',
      required: true,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of relevant chunks to retrieve (default 4, max 10)',
      required: false,
    },
    category: {
      type: 'string',
      description: 'Optional category filter (e.g. architecture, authentication, deployment, domain)',
      required: false,
    },
    sourceFilter: {
      type: 'string',
      description: 'Optional file path or source substring filter',
      required: false,
    },
  },
  handler: async (args: Record<string, any>) => {
    const query = String(args['query'] || '').trim();
    const limit = args['limit'] !== undefined ? Math.min(10, Math.max(1, Number(args['limit']))) : 4;
    const category = args['category'] ? String(args['category']).trim() : undefined;
    const sourceFilter = args['sourceFilter'] ? String(args['sourceFilter']).trim() : undefined;

    if (!query) {
      return {
        success: false,
        error: 'Missing required parameter: query',
      };
    }

    try {
      const results = await knowledgeService.search(query, {
        limit,
        category,
        sourceFilter,
      });

      if (results.length === 0) {
        return {
          success: true,
          query,
          count: 0,
          message: 'No matching documentation found for this query in the knowledge base.',
          results: [],
        };
      }

      return {
        success: true,
        query,
        count: results.length,
        results: results.map((r) => ({
          documentTitle: r.documentTitle,
          source: r.source,
          category: r.category,
          chunkIndex: r.chunkIndex,
          score: Number(r.score.toFixed(3)),
          snippet: r.content,
        })),
        formattedContext: knowledgeService.formatContextForPrompt(results),
      };
    } catch (err: any) {
      logger.error(`Failed to execute search_knowledge: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Knowledge search failed: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 2: retrieve_document
 * Retrieves full document content or sections by ID or title.
 */
export const retrieveDocumentTool: ToolDefinition = {
  slug: 'retrieve_document',
  name: 'Retrieve Document',
  description: 'Retrieves complete document content, metadata, and sections by document ID or title from the project knowledge base.',
  parameters: {
    documentIdOrTitle: {
      type: 'string',
      description: 'The document ID or title keyword to retrieve',
      required: true,
    },
  },
  handler: async (args: Record<string, any>) => {
    const idOrTitle = String(args['documentIdOrTitle'] || args['documentId'] || args['title'] || '').trim();

    if (!idOrTitle) {
      return {
        success: false,
        error: 'Missing required parameter: documentIdOrTitle',
      };
    }

    try {
      const doc = await knowledgeService.getDocument(idOrTitle);
      if (!doc) {
        return {
          success: false,
          error: `No document found matching "${idOrTitle}" in the knowledge base.`,
        };
      }

      return {
        success: true,
        document: {
          id: doc.id,
          title: doc.title,
          source: doc.source,
          category: doc.category,
          tags: doc.tags,
          summary: doc.summary ?? null,
          chunkCount: doc.chunkCount,
          content: doc.content,
          updatedAt: doc.updatedAt,
        },
      };
    } catch (err: any) {
      logger.error(`Failed to retrieve document: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not retrieve document: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 3: summarize_document
 * Summarizes an indexed or uploaded document.
 */
export const summarizeDocumentTool: ToolDefinition = {
  slug: 'summarize_document',
  name: 'Summarize Document',
  description: 'Produces a concise executive summary of an indexed knowledge base document or uploaded file by title or ID.',
  parameters: {
    documentIdOrTitle: {
      type: 'string',
      description: 'The document ID or title keyword to summarize',
      required: true,
    },
  },
  handler: async (args: Record<string, any>) => {
    const idOrTitle = String(args['documentIdOrTitle'] || args['documentId'] || args['title'] || '').trim();

    if (!idOrTitle) {
      return {
        success: false,
        error: 'Missing required parameter: documentIdOrTitle',
      };
    }

    try {
      const summaryResult = await knowledgeService.summarizeDocument(idOrTitle);
      return {
        success: true,
        documentId: summaryResult.documentId,
        title: summaryResult.title,
        source: summaryResult.source,
        summary: summaryResult.summary,
      };
    } catch (err: any) {
      logger.error(`Failed to summarize document: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not summarize document: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * Tool 4: list_knowledge_sources
 * Lists all indexed documents, knowledge sources, and categories.
 */
export const listKnowledgeSourcesTool: ToolDefinition = {
  slug: 'list_knowledge_sources',
  name: 'List Knowledge Sources',
  description: 'Lists all available documents, specifications, and indexed sources in the project knowledge base.',
  parameters: {
    category: {
      type: 'string',
      description: 'Optional category filter to restrict listed sources',
      required: false,
    },
  },
  handler: async (args: Record<string, any>) => {
    const category = args['category'] ? String(args['category']).trim() : undefined;

    try {
      const sources = await knowledgeService.listSources(category);
      return {
        success: true,
        count: sources.length,
        sources: sources.map((s) => ({
          id: s.id,
          title: s.title,
          source: s.source,
          category: s.category,
          tags: s.tags,
          chunkCount: s.chunkCount,
        })),
      };
    } catch (err: any) {
      logger.error(`Failed to list knowledge sources: ${err?.message ?? err}`);
      return {
        success: false,
        error: `Could not list knowledge sources: ${err?.message ?? String(err)}`,
      };
    }
  },
};

/**
 * All Phase 8 knowledge & RAG tools bundled for registration.
 */
export const allKnowledgeTools: ToolDefinition[] = [
  searchKnowledgeTool,
  retrieveDocumentTool,
  summarizeDocumentTool,
  listKnowledgeSourcesTool,
];
