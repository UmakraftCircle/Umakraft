import { FederationContext } from './federation-context.js';
import { LilyLexicalIntelligence } from '../../language/lexical/lily-lexical-intelligence.js';

export interface RouteDecision {
  providerId: string;
  weight: number;
  reason: string;
}

export interface RoutePlan {
  query: string;
  selectedProviders: string[];
  decisions: RouteDecision[];
  semanticExpansions: string[];
}

export class FederationRouter {
  private lexical: LilyLexicalIntelligence;

  constructor(lexical?: LilyLexicalIntelligence) {
    this.lexical = lexical || new LilyLexicalIntelligence();
  }

  /**
   * Semantically expands input query to discover synonyms and phrases.
   */
  public expandQuery(text: string): string[] {
    const expansions = new Set<string>();
    const lower = text.trim().toLowerCase();
    expansions.add(lower);

    // Common domain slang and queries
    if (lower.includes("who's leading") || lower.includes("who is leading") || lower.includes("leading")) {
      expansions.add("leaderboard");
      expansions.add("rank 1");
      expansions.add("top position");
      expansions.add("standings");
    }

    if (lower.includes("how am i doing") || lower.includes("my status")) {
      expansions.add("fans");
      expansions.add("fan gain");
      expansions.add("milestone");
      expansions.add("rank");
    }

    // Use lexical intelligence expansion
    try {
      const synRes = this.lexical.expand(text);
      for (const term of synRes.expandedTerms || []) {
        expansions.add(term.toLowerCase());
      }
      for (const phrase of synRes.expandedPhrases || []) {
        expansions.add(phrase.toLowerCase());
      }
    } catch {
      // Fallback gracefully
    }

    return Array.from(expansions);
  }

  /**
   * Evaluates query text and context to determine participating providers.
   */
  public route(queryText: string, context: FederationContext, registeredProviderIds: string[]): RoutePlan {
    const lower = queryText.trim().toLowerCase();
    const expansions = this.expandQuery(queryText);
    const decisions: RouteDecision[] = [];

    // Indicator checks
    const hasTaxonomySignals =
      context.runningStyle !== undefined ||
      context.character !== undefined ||
      context.distance !== undefined ||
      context.surface !== undefined ||
      /front runner|pace chaser|late surger|end closer|nige|senkou|sashi|oikomi|turf|dirt|sprint|mile|medium|long|aptitude|skill|stat/i.test(lower);

    const hasHandbookSignals =
      context.intent === 'build_guide' ||
      /guide|build|deck|strategy|recommend|tip|training|inheritance|speed|stamina|power|guts|wisdom/i.test(lower) ||
      (context.runningStyle !== undefined && (/build|how to|setup|advice/i.test(lower) || lower.includes('doing')));

    const hasDatabaseSignals =
      context.intent === 'leaderboard' ||
      context.intent === 'fan_progress' ||
      context.intent === 'milestone_check' ||
      context.trainerId !== undefined ||
      /rank|leaderboard|fan|gain|deficit|surplus|milestone|eligible|150m|200m|300m|club|umakraft|how am i doing|my status|who.*leading/i.test(lower);

    const hasLexicalSignals =
      context.intent === 'definition' ||
      /what is|define|meaning|slang|term|synonym|opposite/i.test(lower) ||
      expansions.length > 2;

    // Route Taxonomy
    if (registeredProviderIds.includes('taxonomy')) {
      if (hasTaxonomySignals) {
        decisions.push({
          providerId: 'taxonomy',
          weight: 1.0,
          reason: 'Query references canonical Umamusume taxonomy entities or mechanics.'
        });
      }
    }

    // Route Handbook
    if (registeredProviderIds.includes('handbook')) {
      if (hasHandbookSignals || (hasTaxonomySignals && (lower.includes('guide') || lower.includes('doing') || lower.includes('build')))) {
        decisions.push({
          providerId: 'handbook',
          weight: 0.9,
          reason: 'Query matches strategic guides, build recommendations, or racing tips.'
        });
      }
    }

    // Route Database
    if (registeredProviderIds.includes('database') || registeredProviderIds.includes('database_provider')) {
      const dbId = registeredProviderIds.includes('database_provider') ? 'database_provider' : 'database';
      if (hasDatabaseSignals || lower.includes('how am i doing') || lower.includes('doing as a')) {
        decisions.push({
          providerId: dbId,
          weight: 0.95,
          reason: 'Query requests live trainer statistics, rankings, fan gains, or milestones.'
        });
      }
    }

    // Route Lexical
    if (registeredProviderIds.includes('lexical') || registeredProviderIds.includes('lexical_intelligence')) {
      const lexId = registeredProviderIds.includes('lexical_intelligence') ? 'lexical_intelligence' : 'lexical';
      if (hasLexicalSignals || decisions.length === 0) {
        decisions.push({
          providerId: lexId,
          weight: 0.8,
          reason: 'Query provides semantic clarification and vocabulary expansions.'
        });
      }
    }

    // If no specific signals were matched, fallback to all available providers to ensure maximum recall
    if (decisions.length === 0) {
      for (const id of registeredProviderIds) {
        decisions.push({
          providerId: id,
          weight: 0.5,
          reason: 'Default routing fallback for broad multi-source discovery.'
        });
      }
    }

    const selectedProviders = Array.from(new Set(decisions.map(d => d.providerId)));

    return {
      query: queryText,
      selectedProviders,
      decisions,
      semanticExpansions: expansions
    };
  }
}
