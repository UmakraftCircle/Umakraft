import { KnowledgeRegistry } from './knowledge-registry.js';
import { KnowledgeResolver } from './knowledge-resolver.js';
import { KnowledgeRanking } from './knowledge-ranking.js';
import { KnowledgeCache } from './knowledge-cache.js';
import { KnowledgeQuery } from './knowledge-context.js';
import { KnowledgeResult } from './knowledge-result.js';
import { TaxonomyKnowledgeSource } from './sources/taxonomy-source.js';
import { DatabaseKnowledgeSource } from './sources/database-source.js';
import { HandbookKnowledgeProvider } from './handbook/handbook-provider.js';
import { DatabaseKnowledgeProvider } from './database/database-provider.js';
import { GlossaryKnowledgeSource } from './sources/glossary-source.js';
import { LilyVocabularyProvider } from '../vocabulary/lily-vocabulary-provider.js';
import { DictionaryKnowledgeProvider } from '../vocabulary/dictionary/dictionary-provider.js';
import { SynonymKnowledgeProvider } from '../vocabulary/synonyms/synonym-provider.js';
import { AntonymKnowledgeProvider } from '../vocabulary/antonyms/antonym-provider.js';
import { DefinitionKnowledgeProvider } from '../vocabulary/definitions/definition-provider.js';
import { LilyLexicalIntelligence } from '../language/lexical/lily-lexical-intelligence.js';

export class KnowledgeEngine {
  private registry = new KnowledgeRegistry();
  private ranking = new KnowledgeRanking();
  private cache = new KnowledgeCache();
  private resolver: KnowledgeResolver;

  constructor() {
    this.resolver = new KnowledgeResolver(this.registry, this.ranking);
    this.registerDefaultSources();
  }

  /**
   * Registers default knowledge sources with official hierarchy:
   * Official Taxonomy (100)
   * Database Knowledge Provider (95)
   * Handbook Knowledge Provider (90)
   * Official Database (85)
   * Lily Lexical Intelligence (80)
   * Dictionary Knowledge Provider (75)
   * Definition Knowledge Provider (70)
   * Official Glossary (65)
   * Synonym Knowledge Provider (60)
   * Antonym Knowledge Provider (60)
   * Vocabulary Provider (50)
   */
  private registerDefaultSources(): void {
    this.registry.register(new TaxonomyKnowledgeSource());
    this.registry.register(new DatabaseKnowledgeProvider());
    this.registry.register(new HandbookKnowledgeProvider());
    this.registry.register(new DatabaseKnowledgeSource());
    this.registry.register(new LilyLexicalIntelligence());
    this.registry.register(new DictionaryKnowledgeProvider());
    this.registry.register(new DefinitionKnowledgeProvider());
    this.registry.register(new GlossaryKnowledgeSource());
    this.registry.register(new SynonymKnowledgeProvider());
    this.registry.register(new AntonymKnowledgeProvider());
    this.registry.register(new LilyVocabularyProvider());
  }

  public getRegistry(): KnowledgeRegistry {
    return this.registry;
  }

  public getRanking(): KnowledgeRanking {
    return this.ranking;
  }

  public getCache(): KnowledgeCache {
    return this.cache;
  }

  public getResolver(): KnowledgeResolver {
    return this.resolver;
  }

  /**
   * Primary entry point for knowledge queries.
   * Checks cache first, resolves across registered sources, ranks by authority, caches and returns.
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const term = query.term?.trim();
    if (!term) return [];

    const contextKey = query.context
      ? `${query.context.intent || ''}_${query.context.category || ''}_${query.context.domain || ''}`
      : undefined;

    // Check cache
    const cached = this.cache.get(term, contextKey);
    if (cached) {
      if (query.maxResults && query.maxResults > 0) {
        return cached.slice(0, query.maxResults);
      }
      return cached;
    }

    // Resolve query across sources
    const results = await this.resolver.resolve(query);

    // Populate cache
    this.cache.set(term, results, contextKey);

    return results;
  }
}
