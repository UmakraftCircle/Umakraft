import { KnowledgeSource } from '../../knowledge/knowledge-source.js';
import { KnowledgeQuery } from '../../knowledge/knowledge-context.js';
import { KnowledgeResult } from '../../knowledge/knowledge-result.js';
import { LexicalQuery } from './lexical-query.js';
import { LexicalResult } from './lexical-result.js';
import { LexicalOrchestrator, LexicalOrchestratorDependencies } from './lexical-orchestrator.js';
import { LilyVocabularyProvider } from '../../vocabulary/lily-vocabulary-provider.js';
import { DictionaryKnowledgeProvider } from '../../vocabulary/dictionary/dictionary-provider.js';
import { LilySynonymEngine } from '../../vocabulary/synonyms/synonym-engine.js';
import { LilyAntonymEngine } from '../../vocabulary/antonyms/antonym-engine.js';
import { DefinitionKnowledgeProvider } from '../../vocabulary/definitions/definition-provider.js';
import { VocabularyLearningEngine } from '../../vocabulary/learning/vocabulary-learning-engine.js';

export class LilyLexicalIntelligence implements KnowledgeSource {
  // KnowledgeSource interface properties
  public id = 'lexical_intelligence';
  public name = 'Lily Lexical Intelligence Layer';
  public type = 'lexical';
  public priority = 80; // Authority 80 (Taxonomy: 100 > Lexical Intelligence: 80 > Database: 85 / Handbook: 75 / Dictionary: 75 / Definition: 70)

  private orchestrator: LexicalOrchestrator;

  constructor(deps?: LexicalOrchestratorDependencies) {
    this.orchestrator = new LexicalOrchestrator(deps);
  }

  public getOrchestrator(): LexicalOrchestrator {
    return this.orchestrator;
  }

  public getVocabularyProvider(): LilyVocabularyProvider {
    return this.orchestrator.getVocabularyProvider();
  }

  public getDictionaryProvider(): DictionaryKnowledgeProvider {
    return this.orchestrator.getDictionaryProvider();
  }

  public getSynonymEngine(): LilySynonymEngine {
    return this.orchestrator.getSynonymEngine();
  }

  public getAntonymEngine(): LilyAntonymEngine {
    return this.orchestrator.getAntonymEngine();
  }

  public getDefinitionProvider(): DefinitionKnowledgeProvider {
    return this.orchestrator.getDefinitionProvider();
  }

  public getLearningEngine(): VocabularyLearningEngine {
    return this.orchestrator.getLearningEngine();
  }

  /**
   * Main unified lookup entry point.
   */
  public lookup(query: string | LexicalQuery): LexicalResult {
    return this.orchestrator.orchestrate(query);
  }

  /**
   * Resolves unified lexical result (alias for lookup).
   */
  public resolve(query: string | LexicalQuery): LexicalResult {
    return this.lookup(query);
  }

  /**
   * Direct definition retrieval with optional context disambiguation.
   */
  public define(term: string, context?: string): string | undefined {
    const res = this.lookup({ text: term, context });
    return res.definition || res.phraseMeaning;
  }

  /**
   * Direct synonym retrieval.
   */
  public findSynonyms(
    term: string,
    options?: { maxResults?: number; minConfidence?: number }
  ): string[] {
    const list = this.orchestrator.getSynonymEngine().findSynonyms(term, options);
    return list || [];
  }

  /**
   * Direct antonym retrieval.
   */
  public findAntonyms(
    term: string,
    options?: { maxResults?: number; minConfidence?: number }
  ): string[] {
    const list = this.orchestrator.getAntonymEngine().findAntonyms(term, options);
    return list || [];
  }

  /**
   * Analyzes multi-word phrases, idioms, and compound domain expressions.
   */
  public analyzePhrase(phrase: string): {
    isPhrase: boolean;
    meaning?: string;
    phraseMeaning?: string;
    tokens: string[];
    components: string[];
    expansions: string[];
    oppositePhrases: string[];
  } {
    const normalized = phrase.trim().toLowerCase();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const isPhrase = tokens.length > 1;
    const meaning = this.orchestrator.getRouter().getPhraseMeaning(normalized);

    const synExpansion = this.orchestrator.getSynonymEngine().expand(normalized);
    const antExpansion = this.orchestrator.getAntonymEngine().expandOpposites(normalized);

    return {
      isPhrase,
      meaning,
      phraseMeaning: meaning,
      tokens,
      components: tokens,
      expansions: synExpansion.expandedPhrases || [],
      oppositePhrases: antExpansion.oppositePhrases || []
    };
  }

  /**
   * Observes and registers candidate words in the learning engine.
   */
  public learnCandidate(term: string, context?: string): unknown {
    const textToObserve = context ? `${term} ${context}` : term;
    return this.orchestrator.getLearningEngine().observe(textToObserve);
  }

  /**
   * Semantic expansion of text/phrase across synonyms and phrase combinations.
   */
  public expand(text: string): {
    terms: string[];
    expandedTerms: string[];
    synonyms: Record<string, string[]>;
    phrases: string[];
    expandedPhrases: string[];
  } {
    const synExpansion = this.orchestrator.getSynonymEngine().expand(text);
    return {
      terms: synExpansion.expandedTerms,
      expandedTerms: synExpansion.expandedTerms,
      synonyms: synExpansion.tokenExpansions,
      phrases: synExpansion.expandedPhrases,
      expandedPhrases: synExpansion.expandedPhrases
    };
  }

  /**
   * Calculates overall semantic understanding confidence score.
   */
  public semanticScore(text: string, context?: string): number {
    const res = this.lookup({ text, context });
    return res.semanticScore !== undefined ? res.semanticScore : 0.5;
  }

  /**
   * KnowledgeSource interface implementation for KnowledgeEngine integration (Authority: 80).
   */
  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const term = query.term.trim();
    const context = query.context?.domain || query.context?.intent;
    const res = this.lookup({ text: term, context });

    if (res.confidence < 0.3 && !res.definition && !res.synonyms && !res.phraseMeaning) {
      return [];
    }

    return [
      {
        source: this.id,
        authority: this.priority,
        content: {
          term: res.term,
          definition: res.definition,
          synonyms: res.synonyms,
          antonyms: res.antonyms,
          phraseMeaning: res.phraseMeaning,
          isPhrase: res.isPhrase,
          candidate: res.candidate,
          semanticScore: res.semanticScore
        },
        confidence: res.confidence,
        metadata: {
          subsystem: res.subsystem,
          sources: res.sources,
          context: query.context
        }
      }
    ];
  }
}
