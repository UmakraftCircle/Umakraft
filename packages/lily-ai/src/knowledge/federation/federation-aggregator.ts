import {
  KnowledgeProviderResult,
  FederatedKnowledgeSections,
  ResponsePlan,
  ResponsePlanStep
} from './federation-result.js';
import { FederationContext } from './federation-context.js';
import { FederationRankingEngine } from './federation-ranking.js';

export interface ConflictRecord {
  field: string;
  winningProvider: string;
  losingProvider: string;
  reason: string;
}

export class FederationAggregator {
  /**
   * Merges multi-source provider results into structured sections and unified payload.
   */
  public static aggregate(
    results: Record<string, KnowledgeProviderResult>,
    context: FederationContext
  ): {
    sections: FederatedKnowledgeSections;
    aggregatedData: Record<string, any>;
    conflicts: ConflictRecord[];
    responsePlan: ResponsePlan;
  } {
    const sections: FederatedKnowledgeSections = {};
    const aggregatedData: Record<string, any> = {};
    const conflicts: ConflictRecord[] = [];

    // 1. Ingest Taxonomy Data
    const taxRes = results['taxonomy'];
    if (taxRes && taxRes.data) {
      const taxData = taxRes.data;
      sections.taxonomy = {
        primaryEntity: taxData.primaryEntity || taxData.name || context.runningStyle || context.character,
        matchedCategory: taxData.category || taxData.matchedCategory,
        canonical: taxData.canonical || taxData.name,
        nodes: Array.isArray(taxData.nodes) ? taxData.nodes : (taxData.id ? [taxData] : [])
      };

      if (sections.taxonomy.primaryEntity) {
        aggregatedData.runningStyle = context.runningStyle || taxData.runningStyle || taxData.name;
        aggregatedData.character = context.character || taxData.character;
        aggregatedData.category = taxData.category;
      }
    }

    // 2. Ingest Database Live Data
    const dbRes = results['database'] || results['database_provider'];
    if (dbRes && dbRes.data) {
      const dbData = dbRes.data;
      sections.database = {};

      if (dbData.trainer) sections.database.trainer = dbData.trainer;
      if (dbData.fanStats) sections.database.fanStats = dbData.fanStats;
      if (dbData.leaderboard) sections.database.leaderboard = dbData.leaderboard;
      if (dbData.club) sections.database.club = dbData.club;
      if (dbData.milestoneProgress) sections.database.milestoneProgress = dbData.milestoneProgress;

      // Also support flat database structure
      if (dbData.rank !== undefined) {
        sections.database.leaderboard = {
          rank: dbData.rank,
          trainerName: dbData.trainerName || context.trainerName || 'Trainer',
          fans: dbData.totalFans || dbData.fans || 0,
          nearbyCompetitors: dbData.nearbyCompetitors
        };
      }
      if (dbData.totalFans !== undefined || dbData.dailyGain !== undefined) {
        sections.database.fanStats = {
          totalFans: dbData.totalFans || dbData.fans || 0,
          dailyGain: dbData.dailyGain || 0,
          monthlyGain: dbData.monthlyGain || 0,
          currentMilestone: dbData.currentMilestone,
          nextMilestone: dbData.nextMilestone,
          remainingFansToNextMilestone: dbData.remainingFansToNextMilestone,
          deficit: dbData.deficit,
          surplus: dbData.surplus,
          requiredDailyGain: dbData.requiredDailyGain,
          projectedMonthEnd: dbData.projectedMonthEnd
        };
      }
      if (dbData.isEligible150M !== undefined || dbData.currentMilestone !== undefined) {
        sections.database.milestoneProgress = {
          currentFans: dbData.totalFans || dbData.currentFans || 0,
          currentMilestone: dbData.currentMilestone,
          nextMilestone: dbData.nextMilestone,
          remainingFans: dbData.remainingFans || dbData.remainingFansToNextMilestone || 0,
          isEligible150M: Boolean(dbData.isEligible150M ?? (dbData.totalFans >= 150_000_000)),
          isEligible200M: Boolean(dbData.isEligible200M ?? (dbData.totalFans >= 200_000_000)),
          isEligible300M: Boolean(dbData.isEligible300M ?? (dbData.totalFans >= 300_000_000))
        };
      }

      // Merge into aggregated top-level data
      if (sections.database.leaderboard?.rank) {
        aggregatedData.rank = sections.database.leaderboard.rank;
      }
      if (sections.database.fanStats?.totalFans) {
        aggregatedData.totalFans = sections.database.fanStats.totalFans;
      }
      if (sections.database.trainer?.trainerName) {
        aggregatedData.trainerName = sections.database.trainer.trainerName;
      }
    }

    // 3. Ingest Handbook Guide Data
    const hbRes = results['handbook'];
    if (hbRes && hbRes.data) {
      const hbData = hbRes.data;
      const guides = Array.isArray(hbData.guides)
        ? hbData.guides
        : (Array.isArray(hbData) ? hbData : (hbData.id ? [hbData] : []));

      const primaryRec = hbData.primaryRecommendation ||
        (guides[0]?.recommendations?.[0]) ||
        (typeof hbData.recommendation === 'string' ? hbData.recommendation : undefined) ||
        (guides[0]?.summary);

      sections.handbook = {
        guides: guides.map((g: any) => ({
          id: g.id || g.document?.id,
          title: g.title || g.document?.title,
          category: g.category || g.document?.category,
          recommendations: g.recommendations || g.document?.recommendations,
          summary: g.summary || g.content?.slice(0, 150) || g.document?.content?.slice(0, 150),
          content: g.content || g.document?.content,
          version: g.version || g.document?.version
        })),
        primaryRecommendation: primaryRec,
        suggestedBuild: hbData.suggestedBuild || hbData.build
      };

      if (primaryRec) {
        aggregatedData.recommendation = primaryRec;
      }
    }

    // 4. Ingest Lexical Data
    const lexRes = results['lexical'] || results['lexical_intelligence'];
    if (lexRes && lexRes.data) {
      const lexData = lexRes.data;
      sections.lexical = {
        definition: lexData.definition,
        synonyms: lexData.synonyms,
        antonyms: lexData.antonyms,
        phraseMeaning: lexData.phraseMeaning,
        expandedTerms: lexData.expandedTerms,
        semanticScore: lexData.semanticScore
      };

      if (lexData.definition && !aggregatedData.definition) {
        aggregatedData.definition = lexData.definition;
      }
    }

    // 5. Conflict Resolution between sources
    // Rule 1: Live DB stats override static guide/taxonomy stats
    if (taxRes && dbRes && taxRes.data?.rank && dbRes.data?.rank) {
      if (taxRes.data.rank !== dbRes.data.rank) {
        conflicts.push({
          field: 'rank',
          winningProvider: dbRes.providerId,
          losingProvider: taxRes.providerId,
          reason: 'Database live rank overrides static taxonomy rank estimation.'
        });
      }
    }

    // Rule 2: Handbook version conflict resolution (Newer version wins)
    if (sections.handbook?.guides && sections.handbook.guides.length > 1) {
      const sortedGuides = [...sections.handbook.guides].sort((a, b) => {
        const vA = parseFloat(a.version || '1.0');
        const vB = parseFloat(b.version || '1.0');
        return vB - vA;
      });
      if (sortedGuides[0] && sortedGuides[1] && sortedGuides[0].version !== sortedGuides[1].version) {
        conflicts.push({
          field: 'guide_version',
          winningProvider: 'handbook',
          losingProvider: 'handbook_legacy',
          reason: `Resolved guide conflict in favor of v${sortedGuides[0].version} over v${sortedGuides[1].version}.`
        });
      }
    }

    // 6. Build Structured Response Plan
    const responsePlan = this.buildResponsePlan(sections, context, aggregatedData);

    return {
      sections,
      aggregatedData,
      conflicts,
      responsePlan
    };
  }

  /**
   * Generates a 3-4 step structured response plan.
   */
  private static buildResponsePlan(
    sections: FederatedKnowledgeSections,
    context: FederationContext,
    aggregatedData: Record<string, any>
  ): ResponsePlan {
    const rawSteps: ResponsePlanStep[] = [];
    const runningStyle = context.runningStyle || aggregatedData.runningStyle || 'Trainer';

    // Step 1: Current Situation (from Database)
    if (sections.database) {
      const db = sections.database;
      const rankStr = db.leaderboard?.rank ? `Rank #${db.leaderboard.rank}` : undefined;
      const fanCount = db.fanStats?.totalFans || db.milestoneProgress?.currentFans;
      const fansStr = fanCount ? `${Math.round(fanCount / 1_000_000)}M fans` : undefined;

      const detail = [rankStr, fansStr].filter(Boolean).join(' with ');
      if (detail) {
        let text = `You are currently ${detail}.`;
        if (db.milestoneProgress?.currentMilestone) {
          text += ` You have reached the ${db.milestoneProgress.currentMilestone} threshold.`;
        }
        rawSteps.push({
          type: 'current_situation',
          title: 'Current Operational Standing',
          content: text,
          sourceProvider: 'database',
          confidence: 0.98,
          metadata: { rank: db.leaderboard?.rank, fans: fanCount }
        });
      }
    }

    // Step 2: Relevant Guide (from Handbook)
    if (sections.handbook && sections.handbook.primaryRecommendation) {
      rawSteps.push({
        type: 'relevant_guide',
        title: 'Strategy & Execution Guide',
        content: `As a ${runningStyle}, ${sections.handbook.primaryRecommendation}`,
        sourceProvider: 'handbook',
        confidence: 0.92,
        metadata: { recommendation: sections.handbook.primaryRecommendation }
      });
    }

    // Step 3: Foundational Concept (from Taxonomy)
    if (sections.taxonomy && sections.taxonomy.canonical) {
      const cat = sections.taxonomy.matchedCategory ? ` (${sections.taxonomy.matchedCategory})` : '';
      rawSteps.push({
        type: 'foundational_concept',
        title: 'Tactical Classification',
        content: `Strategy aligns with canonical Umamusume taxonomy for ${sections.taxonomy.canonical}${cat}.`,
        sourceProvider: 'taxonomy',
        confidence: 0.95
      });
    }

    // Step 4: Recommended Action
    let suggestedAction = 'Continue consistent daily fan pacing and maintain training routines.';
    if (sections.database?.fanStats?.remainingFansToNextMilestone && sections.database?.fanStats?.nextMilestone) {
      const remM = Math.round(sections.database.fanStats.remainingFansToNextMilestone / 1_000_000);
      suggestedAction = `Progressing toward ${sections.database.fanStats.nextMilestone} milestone (${remM}M fans remaining).`;
    } else if (sections.handbook?.primaryRecommendation) {
      suggestedAction = `Focus on ${sections.handbook.primaryRecommendation}`;
    }

    rawSteps.push({
      type: 'recommended_action',
      title: 'Next Tactical Priority',
      content: suggestedAction,
      sourceProvider: 'federation_planner',
      confidence: 0.90
    });

    // Step 5: Lexical Note (if applicable)
    if (sections.lexical?.definition) {
      rawSteps.push({
        type: 'lexical_note',
        title: 'Lexical Context',
        content: sections.lexical.definition,
        sourceProvider: 'lexical',
        confidence: 0.85
      });
    }

    const orderedSteps = FederationRankingEngine.rankPlanSteps(rawSteps);

    const headline = sections.database?.leaderboard?.rank
      ? `Operational Status: Rank #${sections.database.leaderboard.rank} (${runningStyle})`
      : `Intelligence Overview for ${runningStyle}`;

    // Compose concise summary paragraph
    const summaryLines = orderedSteps.map(s => s.content);
    const summaryText = summaryLines.join(' ');

    return {
      headline,
      steps: orderedSteps,
      suggestedAction,
      summaryText
    };
  }
}
