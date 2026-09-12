import { IKnowledgeService } from './index.js';
import { LanguageAnalysis } from '../language/language-analysis.js';
import { KnowledgeAnalysis, ConfidenceLevel, KnowledgeSource } from './knowledge-analysis.js';
import { KnowledgeClassifier } from './knowledge-classifier.js';
import { SourceRegistry } from './source-registry.js';
import { KnowledgeFederationService } from '../../knowledge/federation/knowledge-federation.js';
import { FederatedResult, FederationQuery } from '../../knowledge/federation/index.js';

export class LilyKnowledgeService implements IKnowledgeService {
  private classifier = new KnowledgeClassifier();
  private sourceRegistry = new SourceRegistry();
  private federation = new KnowledgeFederationService();

  public getFederationService(): KnowledgeFederationService {
    return this.federation;
  }

  public async resolveFederated(query: FederationQuery | string): Promise<FederatedResult> {
    return await this.federation.query(query);
  }

  public analyze(languageAnalysis: LanguageAnalysis): KnowledgeAnalysis {
    const classification = this.classifier.classify(languageAnalysis);
    const source = this.sourceRegistry.getSourceForDomain(classification.domain);

    let confidenceLevel = ConfidenceLevel.NONE;
    if (classification.confidence >= 0.95) confidenceLevel = ConfidenceLevel.HIGH;
    else if (classification.confidence >= 0.85) confidenceLevel = ConfidenceLevel.MEDIUM;
    else if (classification.confidence >= 0.5) confidenceLevel = ConfidenceLevel.LOW;

    return {
      domain: classification.domain,
      source: source,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
      evidence: {
        source: source,
        confidence: confidenceLevel
      }
    };
  }

  public isSourceAllowedForTrainer(source: string): boolean {
    return this.sourceRegistry.isSourceAllowed('trainer_data', source as any);
  }

  public isSourceAllowedForClub(source: string): boolean {
    return this.sourceRegistry.isSourceAllowed('club_data', source as any);
  }

  public isSourceAllowedForLink(source: string): boolean {
    return this.sourceRegistry.isSourceAllowed('account_linking', source as any);
  }
}

