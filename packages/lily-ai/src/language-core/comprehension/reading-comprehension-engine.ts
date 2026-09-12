import { Fact, FactDetector } from './fact-detector.js';
import { Relationship, RelationshipEngine } from './relationship-engine.js';
import { NumberFact, NumericComprehension } from './numeric-comprehension.js';
import { ContextBuilder, ComprehensionContext } from './context-builder.js';
import { SemanticAnalyzer } from './semantic-analyzer.js';
import { InformationExtractor } from './information-extractor.js';
import { GlossaryService } from '../glossary-service.js';

export interface Entity {
  name: string;
  type: string;
  domain?: string;
}

export interface ComprehensionResult {
  facts: Fact[];
  entities: Entity[];
  relationships: Relationship[];
  numbers: NumberFact[];
  categories: string[];
  confidence: number;
  context?: ComprehensionContext;
}

export class ReadingComprehensionEngine {
  private glossaryService: GlossaryService;
  private factDetector = new FactDetector();
  private relationshipEngine = new RelationshipEngine();
  private numericComprehension = new NumericComprehension();
  private contextBuilder = new ContextBuilder();
  private semanticAnalyzer: SemanticAnalyzer;
  private infoExtractor = new InformationExtractor();

  constructor(glossaryService: GlossaryService) {
    this.glossaryService = glossaryService;
    this.semanticAnalyzer = new SemanticAnalyzer(glossaryService);
  }

  /**
   * Orchestrates the comprehension pipeline to analyze, structure, and understand raw input.
   */
  public comprehend(text: string): ComprehensionResult {
    const normalized = text.toLowerCase();

    // 1. Extract Numbers
    const numbers = this.numericComprehension.extractNumbers(text);

    // 2. Detect Facts
    const facts = this.factDetector.detectFacts(text);

    // 3. Extract entities via Glossary Service matched terms
    const glossaryMatches = this.glossaryService.matchTerms(text);
    const entities: Entity[] = glossaryMatches.map(g => ({
      name: g.term,
      type: g.type || 'term',
      domain: g.domain
    }));

    // 4. Analyze Relationships
    const relationships = this.relationshipEngine.analyzeRelationships(facts, text);

    // 5. Semantic Classification (Categories and intents)
    const classification = this.semanticAnalyzer.analyze(text);
    const categories = classification.categories;

    // 6. Build High-Level Context
    const context = this.contextBuilder.buildContext(text);

    // 7. Calculate Confidence Score based on matches
    let confidence = 0.5;
    if (entities.length > 0) confidence += 0.2;
    if (facts.length > 0) confidence += 0.15;
    if (numbers.length > 0) confidence += 0.15;
    confidence = Math.min(confidence, 1.0);

    return {
      facts,
      entities,
      relationships,
      numbers,
      categories,
      confidence,
      context
    };
  }
}
