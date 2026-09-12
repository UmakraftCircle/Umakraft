import { ILanguageService } from './index.js';
import { LanguageAnalysis } from './language-analysis.js';
import { IntentDetector } from './intent-detector.js';
import { TaxonomyResolver } from './taxonomy-resolver.js';
import { EntityExtractor } from './entity-extractor.js';
import { LilySynonymEngine } from '../../vocabulary/synonyms/synonym-engine.js';
import { LilyAntonymEngine } from '../../vocabulary/antonyms/antonym-engine.js';
import { DefinitionKnowledgeProvider } from '../../vocabulary/definitions/definition-provider.js';
import { VocabularyLearningEngine } from '../../vocabulary/learning/vocabulary-learning-engine.js';
import { LilyLexicalIntelligence } from '../../language/lexical/lily-lexical-intelligence.js';

export class LilyLanguageService implements ILanguageService {
  private intentDetector = new IntentDetector();
  private taxonomyResolver = new TaxonomyResolver();
  private entityExtractor = new EntityExtractor();
  private lexicalIntelligence = new LilyLexicalIntelligence();

  public getLexicalIntelligence(): LilyLexicalIntelligence {
    return this.lexicalIntelligence;
  }

  public getSynonymEngine(): LilySynonymEngine {
    return this.lexicalIntelligence.getSynonymEngine();
  }

  public getAntonymEngine(): LilyAntonymEngine {
    return this.lexicalIntelligence.getAntonymEngine();
  }

  public getDefinitionProvider(): DefinitionKnowledgeProvider {
    return this.lexicalIntelligence.getDefinitionProvider();
  }

  public getLearningEngine(): VocabularyLearningEngine {
    return this.lexicalIntelligence.getLearningEngine();
  }

  /**
   * Analyzes a raw user message and produces a structured LanguageAnalysis.
   * Does NOT make any external AI calls. Uses regex, taxonomy, lexical intelligence, and rules.
   */
  public analyze(message: string): LanguageAnalysis {
    // 1. Normalize Messages
    const normalizedMessage = message.trim().toLowerCase();

    // 2. Expand Synonyms (LanguageCore F15 & F20 pipeline)
    const expansion = this.lexicalIntelligence.expand(normalizedMessage);
    const expandedTerms = expansion.expandedTerms;
    const synonyms = expansion.synonyms;

    // 3. Expand Antonyms / Opposites (LanguageCore F16 & F20 pipeline)
    const antonymExpansion = this.lexicalIntelligence.getAntonymEngine().expandOpposites(normalizedMessage);
    const oppositeTerms = antonymExpansion.oppositeTerms;
    const antonyms = antonymExpansion.tokenAntonyms;

    // 4. Resolve Deep Definitions via Lexical Intelligence (LanguageCore F18 & F20 pipeline)
    const tokens = normalizedMessage.split(/[^a-z0-9_-]+/i).filter(t => t.length > 2);
    const definitions: Record<string, string> = {};

    for (const token of tokens) {
      const def = this.lexicalIntelligence.define(token, normalizedMessage);
      if (def) {
        definitions[token] = def;
      }
    }

    // 5. Extract Entities (e.g. trainer IDs, numbers)
    const entities = this.entityExtractor.extract(normalizedMessage);

    // 6. Resolve Taxonomy (e.g. distances, styles, factors)
    const taxonomyMatches = this.taxonomyResolver.resolve(normalizedMessage);

    // 7. Detect Intent
    const { intent, confidence } = this.intentDetector.detect(
      normalizedMessage,
      taxonomyMatches,
      entities
    );

    // 8. Observe unknown terms via Learning Engine (LanguageCore F19 & F20 pipeline - Candidate Tracking)
    const observedCandidates = this.lexicalIntelligence.getLearningEngine().observe(normalizedMessage);

    // 9. Produce LanguageAnalysis
    const trainerIdEntity = entities.find(e => e.type === 'trainer_id');
    const trainerId = trainerIdEntity ? trainerIdEntity.value : undefined;

    return {
      intent,
      confidence,
      taxonomyMatches,
      entities,
      normalizedMessage,
      trainerId,
      expandedTerms,
      synonyms,
      oppositeTerms,
      antonyms,
      definitions,
      observedCandidates
    };
  }
}

