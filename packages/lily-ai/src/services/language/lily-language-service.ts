import { ILanguageService } from './index.js';
import { LanguageAnalysis } from './language-analysis.js';
import { IntentDetector } from './intent-detector.js';
import { TaxonomyResolver } from './taxonomy-resolver.js';
import { EntityExtractor } from './entity-extractor.js';

export class LilyLanguageService implements ILanguageService {
  private intentDetector = new IntentDetector();
  private taxonomyResolver = new TaxonomyResolver();
  private entityExtractor = new EntityExtractor();

  /**
   * Analyzes a raw user message and produces a structured LanguageAnalysis.
   * Does NOT make any external AI calls. Uses regex, taxonomy, and rules.
   */
  public analyze(message: string): LanguageAnalysis {
    // 1. Normalize Messages
    const normalizedMessage = message.trim().toLowerCase();

    // 2. Extract Entities (e.g. trainer IDs, numbers)
    const entities = this.entityExtractor.extract(normalizedMessage);

    // 3. Resolve Taxonomy (e.g. distances, styles, factors)
    const taxonomyMatches = this.taxonomyResolver.resolve(normalizedMessage);

    // 4. Detect Intent
    const { intent, confidence } = this.intentDetector.detect(
      normalizedMessage,
      taxonomyMatches,
      entities
    );

    // 5. Produce LanguageAnalysis
    const trainerIdEntity = entities.find(e => e.type === 'trainer_id');
    const trainerId = trainerIdEntity ? trainerIdEntity.value : undefined;

    return {
      intent,
      confidence,
      taxonomyMatches,
      entities,
      normalizedMessage,
      trainerId
    };
  }
}
