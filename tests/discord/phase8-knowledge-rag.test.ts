import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  KnowledgeService,
  chunkDocumentText,
  knowledgeService,
  searchKnowledgeTool,
  retrieveDocumentTool,
  summarizeDocumentTool,
  listKnowledgeSourcesTool,
} from '@ai-agent-platform/integrations';
import { MockEmbeddingGenerator } from '@ai-agent-platform/ai';
import { ToolRegistry, ToolCallingAgent } from '@ai-agent-platform/core';
import { generateChatResponse } from '../../apps/discord/src/chat.js';

describe('Phase 8: Knowledge Base & Retrieval-Augmented Generation (RAG)', () => {
  let originalFetch: typeof globalThis.fetch;
  let originalProvider: string | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    originalProvider = process.env['AI_PROVIDER'];
    process.env['AI_PROVIDER'] = 'openai';
    process.env['OPENAI_API_KEY'] = 'mock-openai-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalProvider !== undefined) {
      process.env['AI_PROVIDER'] = originalProvider;
    } else {
      delete process.env['AI_PROVIDER'];
    }
    delete process.env['OPENAI_API_KEY'];
  });

  describe('1. Document Pipeline & Chunking Engine', () => {
    it('splits long markdown documents into coherent chunks with overlap', () => {
      const markdown = `
# System Architecture

## Component 1: Engine
The engine handles topological layer execution and task orchestration across multiple worker pools.

## Component 2: Memory
The memory system utilizes vector cosine similarity and durable Turso storage.

## Component 3: Security
All tools are strictly validated before execution to prevent parameter tampering.
`.trim();

      const chunks = chunkDocumentText(markdown, { maxChunkSize: 150, overlap: 30 });
      assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
      for (const chunk of chunks) {
        assert.ok(chunk.length > 0);
      }
    });

    it('returns empty array for empty or whitespace text', () => {
      assert.deepStrictEqual(chunkDocumentText(''), []);
      assert.deepStrictEqual(chunkDocumentText('   \n\n  '), []);
    });

    it('keeps short text as a single chunk', () => {
      const short = '# Overview\nSimple single chunk document.';
      const chunks = chunkDocumentText(short, { maxChunkSize: 500 });
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0], short);
    });
  });

  describe('2. KnowledgeService Ingestion & Hybrid Retrieval', () => {
    let service: KnowledgeService;

    beforeEach(async () => {
      service = new KnowledgeService(new MockEmbeddingGenerator(64));
      await service.clear();
    });

    it('ingests documents, creates chunks, and searches with hybrid scoring', async () => {
      const doc = await service.ingestDocument({
        id: 'doc-auth-test',
        title: 'Authentication & Session Architecture',
        category: 'authentication',
        source: 'docs/auth.md',
        tags: ['auth', 'session', 'gateway', 'security'],
        content: `
# Authentication Guide
The platform validates bot tokens via DISCORD_TOKEN.
DM channels use deterministic session keys formatted as discord-dm:<userId>.
Cross-talk between different users is strictly isolated.
`.trim(),
      });

      assert.strictEqual(doc.id, 'doc-auth-test');
      assert.strictEqual(doc.chunkCount >= 1, true);

      const searchResults = await service.search('authentication bot tokens', { limit: 3 });
      assert.ok(searchResults.length >= 1, 'Expected at least 1 search match');
      assert.strictEqual(searchResults[0].documentId, 'doc-auth-test');
      assert.ok(searchResults[0].score > 0);
      assert.ok(searchResults[0].content.includes('DISCORD_TOKEN'));
    });

    it('retrieves full document content by ID or title', async () => {
      await service.ingestDocument({
        id: 'doc-deploy-test',
        title: 'Cloud Run Deployment Guide',
        category: 'deployment',
        source: 'docs/deploy.md',
        tags: ['deployment', 'cloud-run', 'nginx'],
        content: 'Deployments run on Cloud Run containers behind Nginx reverse proxy on Port 3000.',
      });

      const byId = await service.getDocument('doc-deploy-test');
      assert.ok(byId);
      assert.strictEqual(byId?.title, 'Cloud Run Deployment Guide');

      const byTitle = await service.getDocument('Deployment Guide');
      assert.ok(byTitle);
      assert.strictEqual(byTitle?.id, 'doc-deploy-test');
    });

    it('lists knowledge sources with category filtering', async () => {
      await service.ingestDocument({
        id: 'doc-cat-1',
        title: 'Auth Spec',
        category: 'security',
        content: 'Auth content...',
      });
      await service.ingestDocument({
        id: 'doc-cat-2',
        title: 'Database Schema',
        category: 'database',
        content: 'DB content...',
      });

      const allSources = await service.listSources();
      assert.strictEqual(allSources.length, 2);

      const secSources = await service.listSources('security');
      assert.strictEqual(secSources.length, 1);
      assert.strictEqual(secSources[0].title, 'Auth Spec');
    });

    it('formats prompt-ready context with citations', async () => {
      await service.ingestDocument({
        id: 'doc-cite',
        title: 'Core Architecture Guide',
        source: 'docs/architecture/final-architecture.md',
        content: 'Topological scheduling executes tasks in mathematically verified layers.',
      });

      const results = await service.search('topological scheduling');
      const formatted = service.formatContextForPrompt(results);

      assert.ok(formatted.includes('Grounded Knowledge Base Context'));
      assert.ok(formatted.includes('Core Architecture Guide'));
      assert.ok(formatted.includes('docs/architecture/final-architecture.md'));
      assert.ok(formatted.includes('Topological scheduling'));
    });
  });

  describe('3. Knowledge Tools Execution Suite', () => {
    it('executes search_knowledge tool and returns formatted results', async () => {
      const result = await searchKnowledgeTool.handler({
        query: 'authentication Discord gateway',
        limit: 2,
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.count >= 1);
      assert.ok(result.results.length >= 1);
      assert.ok(result.results[0].documentTitle.length > 0);
      assert.ok(result.formattedContext.includes('Knowledge Base Context'));
    });

    it('executes retrieve_document tool for existing document', async () => {
      const result = await retrieveDocumentTool.handler({
        documentIdOrTitle: 'Authentication & Discord Gateway Specification',
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.document);
      assert.strictEqual(result.document.category, 'authentication');
      assert.ok(result.document.content.includes('DISCORD_TOKEN'));
    });

    it('returns structured error when document is not found', async () => {
      const result = await retrieveDocumentTool.handler({
        documentIdOrTitle: 'non_existent_secret_doc_xyz',
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('No document found'));
    });

    it('executes summarize_document tool', async () => {
      const result = await summarizeDocumentTool.handler({
        documentIdOrTitle: 'Authentication & Discord Gateway Specification',
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.summary.length > 0);
      assert.strictEqual(result.title, 'Authentication & Discord Gateway Specification');
    });

    it('executes list_knowledge_sources tool', async () => {
      const result = await listKnowledgeSourcesTool.handler({});

      assert.strictEqual(result.success, true);
      assert.ok(result.count >= 3);
      assert.ok(result.sources.some((s: any) => s.category === 'authentication'));
      assert.ok(result.sources.some((s: any) => s.category === 'architecture'));
    });
  });

  describe('4. Autonomous RAG Agent Tool Calling & Context Injection', () => {
    it('agent calls search_knowledge on "What do the project docs say about authentication?"', async () => {
      const userId = 'trainer_rag_auth_1';
      const channelId = `dm-rag-auth-${Date.now()}`;
      let searchKnowledgeCalled = false;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const lastUser = msgs[msgs.length - 1]?.content || '';

        // Step 1: Model autonomously calls search_knowledge tool
        if (!lastUser.includes('Tool search_knowledge returned:')) {
          searchKnowledgeCalled = true;
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_rag_auth_1',
                        type: 'function',
                        function: {
                          name: 'search_knowledge',
                          arguments: JSON.stringify({ query: 'authentication bot tokens and gateway' }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Step 2: Model synthesizes grounded response with source citation
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'According to our Authentication & Discord Gateway Specification, the platform authenticates via DISCORD_TOKEN and enforces strict session isolation for DM channels using discord-dm:<userId> keys.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const reply = await generateChatResponse({
        userId,
        channelId,
        message: 'What do the project docs say about authentication?',
      });

      assert.strictEqual(searchKnowledgeCalled, true, 'search_knowledge tool should have been invoked');
      assert.match(reply, /Authentication & Discord Gateway Specification|DISCORD_TOKEN|session isolation/i);
    });

    it('agent calls search_knowledge on "What is our deployment architecture?"', async () => {
      const userId = 'trainer_rag_deploy_1';
      const channelId = `dm-rag-deploy-${Date.now()}`;
      let searchKnowledgeCalled = false;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const lastUser = msgs[msgs.length - 1]?.content || '';

        // Step 1: Model calls search_knowledge
        if (!lastUser.includes('Tool search_knowledge returned:')) {
          searchKnowledgeCalled = true;
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_rag_deploy_1',
                        type: 'function',
                        function: {
                          name: 'search_knowledge',
                          arguments: JSON.stringify({ query: 'deployment architecture Cloud Run port 3000' }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Step 2: Grounded answer synthesis
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'Based on our Deployment Architecture documentation, Umakraft is deployed on Google Cloud Run containers managed behind an Nginx reverse proxy routing all traffic strictly through Port 3000.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const reply = await generateChatResponse({
        userId,
        channelId,
        message: 'What is our deployment architecture?',
      });

      assert.strictEqual(searchKnowledgeCalled, true);
      assert.match(reply, /Cloud Run|Port 3000|Nginx reverse proxy/i);
    });

    it('agent calls summarize_document on "Summarize the uploaded document"', async () => {
      const userId = 'trainer_rag_sum_1';
      const channelId = `dm-rag-sum-${Date.now()}`;
      let summarizeCalled = false;

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const bodyStr = typeof init?.body === 'string' ? init.body : '';
        const parsed = JSON.parse(bodyStr || '{}');
        const msgs = parsed.messages || [];
        const lastUser = msgs[msgs.length - 1]?.content || '';

        // Step 1: Model calls summarize_document
        if (!lastUser.includes('Tool summarize_document returned:')) {
          summarizeCalled = true;
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_rag_sum_1',
                        type: 'function',
                        function: {
                          name: 'summarize_document',
                          arguments: JSON.stringify({
                            documentIdOrTitle: 'Authentication & Discord Gateway Specification',
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Step 2: Synthesize summary
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content:
                    'Here is the summary of the Authentication & Discord Gateway Specification: It outlines token management using DISCORD_TOKEN, deterministic session keys for DMs, and strict user isolation.',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const reply = await generateChatResponse({
        userId,
        channelId,
        message: 'Summarize the uploaded document for Authentication & Discord Gateway Specification.',
      });

      assert.strictEqual(summarizeCalled, true);
      assert.match(reply, /summary of the Authentication|DISCORD_TOKEN|session/i);
    });
  });
});
