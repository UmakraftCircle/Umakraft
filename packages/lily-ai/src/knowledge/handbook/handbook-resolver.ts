import { TaxonomyKnowledgeProvider } from '../providers/taxonomy/taxonomy-provider.js';
import { LilyLexicalIntelligence } from '../../language/lexical/lily-lexical-intelligence.js';

export interface SemanticHandbookQueryContext {
  originalQuery: string;
  normalizedQuery: string;
  taxonomyMatches: string[];
  semanticTokens: string[];
  expandedPhrases: string[];
}

export class HandbookResolver {
  private taxonomyProvider: TaxonomyKnowledgeProvider;
  private lexicalIntelligence: LilyLexicalIntelligence;

  constructor(taxonomyProvider?: TaxonomyKnowledgeProvider, lexicalIntelligence?: LilyLexicalIntelligence) {
    this.taxonomyProvider = taxonomyProvider || new TaxonomyKnowledgeProvider();
    this.lexicalIntelligence = lexicalIntelligence || new LilyLexicalIntelligence();
  }

  /**
   * Resolves query with Taxonomy and Lexical Intelligence.
   */
  public resolve(rawQuery: string): SemanticHandbookQueryContext {
    const normalizedQuery = rawQuery.trim().toLowerCase();

    // 1. Taxonomy resolution (Characters, Styles, Skills, Tracks, Cards)
    const taxResolution = this.taxonomyProvider.resolve(normalizedQuery);
    const taxonomyMatches: string[] = [];

    if (taxResolution.id) {
      taxonomyMatches.push(taxResolution.id);
    }
    if (taxResolution.name) {
      taxonomyMatches.push(taxResolution.name);
    }
    if (taxResolution.officialName) {
      taxonomyMatches.push(taxResolution.officialName);
    }
    if (taxResolution.node) {
      taxonomyMatches.push(taxResolution.node.id, taxResolution.node.name);
    }
    if (taxResolution.matches) {
      for (const m of taxResolution.matches) {
        taxonomyMatches.push(m);
      }
    }
    if (taxResolution.candidateNodes) {
      for (const c of taxResolution.candidateNodes) {
        taxonomyMatches.push(c.id, c.name);
      }
    }

    // Check individual words / tokens in query against taxonomy if whole query didn't match direct node
    if (taxonomyMatches.length === 0) {
      const words = normalizedQuery.split(/[^a-z0-9_-]+/i).filter(w => w.length > 2);
      for (const word of words) {
        const wordRes = this.taxonomyProvider.resolve(word);
        if (wordRes.node) {
          taxonomyMatches.push(wordRes.node.id, wordRes.node.name);
        } else if (wordRes.matches) {
          taxonomyMatches.push(...wordRes.matches);
        }
      }
    }

    // 2. Lexical Intelligence Semantic Expansion (Synonyms, Phrases)
    const lexicalExpansion = this.lexicalIntelligence.expand(normalizedQuery);
    const semanticTokens = Array.from(new Set([
      ...normalizedQuery.split(/[^a-z0-9_-]+/i).filter(w => w.length > 2),
      ...(lexicalExpansion.terms || []),
      ...(lexicalExpansion.expandedTerms || [])
    ]));

    const expandedPhrases = lexicalExpansion.phrases || [];

    return {
      originalQuery: rawQuery,
      normalizedQuery,
      taxonomyMatches: Array.from(new Set(taxonomyMatches)),
      semanticTokens,
      expandedPhrases
    };
  }
}


