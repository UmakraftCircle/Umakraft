import { ComparisonEngine, Comparison } from './comparison-engine.js';
import { CalculationEngine, CalculationResult } from './calculation-engine.js';
import { DeductionEngine, Deduction } from './deduction-engine.js';
import { PatternEngine, Pattern } from './pattern-engine.js';
import { ConsistencyEngine, ConsistencyResult } from './consistency-engine.js';
import { ConclusionEngine, Conclusion } from './conclusion-engine.js';
import { ReasoningMemory } from './reasoning-memory.js';
import { ReasoningCache } from './reasoning-cache.js';
import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export interface ReasoningInput {
  text: string;
  facts?: any[];
  entities?: any[];
  context?: Record<string, any>;
  previousInteractions?: any[];
}

export interface ReasoningResult {
  comparisons: Comparison[];
  deductions: Deduction[];
  conclusions: Conclusion[];
  patterns: Pattern[];
  consistency: ConsistencyResult;
  confidence: number;
  taxonomy?: {
    runningStyle?: string;
    distance?: string;
    surface?: string;
    track?: string;
    [key: string]: any;
  };
}

export class ReasoningEngine {
  private comparison = new ComparisonEngine();
  private calculation = new CalculationEngine();
  private deduction = new DeductionEngine();
  private pattern = new PatternEngine();
  private consistency = new ConsistencyEngine();
  private conclusion = new ConclusionEngine();
  private memory = new ReasoningMemory();
  private cache = new ReasoningCache();

  // Backward compatibility with F1 test suite
  public compare(a: number, b: number): 'GREATER' | 'LESS' | 'EQUAL' {
    if (a > b) return 'GREATER';
    if (a < b) return 'LESS';
    return 'EQUAL';
  }

  public difference(a: number, b: number): number {
    return Math.abs(a - b);
  }

  public getComparisonEngine(): ComparisonEngine {
    return this.comparison;
  }

  public getCalculationEngine(): CalculationEngine {
    return this.calculation;
  }

  public getDeductionEngine(): DeductionEngine {
    return this.deduction;
  }

  public getPatternEngine(): PatternEngine {
    return this.pattern;
  }

  public getConsistencyEngine(): ConsistencyEngine {
    return this.consistency;
  }

  public getConclusionEngine(): ConclusionEngine {
    return this.conclusion;
  }

  public getReasoningMemory(): ReasoningMemory {
    return this.memory;
  }

  public getReasoningCache(): ReasoningCache {
    return this.cache;
  }

  /**
   * Performs taxonomy-aware reasoning using official taxonomy definitions
   * Priority: Official Taxonomy -> Glossary -> Dictionary
   */
  public reasonTaxonomy(text: string, facts: any[] = []): Record<string, string> {
    const result: Record<string, string> = {};
    const normalized = text.toLowerCase();

    for (const entity of TAXONOMY_DATA) {
      const match = entity.aliases.some(alias => {
        const aliasLower = alias.toLowerCase();
        // Match word boundaries or exact phrases
        const regex = new RegExp(`\\b${aliasLower}\\b`, 'i');
        return regex.test(normalized);
      });

      if (match) {
        switch (entity.type) {
          case 'running_style':
            if (!result.runningStyle) result.runningStyle = entity.canonical;
            break;
          case 'distance':
            if (!result.distance) result.distance = entity.canonical;
            break;
          case 'surface':
            if (!result.surface) result.surface = entity.canonical;
            break;
          case 'track':
            if (!result.track) result.track = entity.canonical;
            break;
        }
      }
    }

    // Inspect facts as well
    for (const f of facts) {
      const valStr = String(f.value || f.text || '').toLowerCase();
      for (const entity of TAXONOMY_DATA) {
        if (entity.aliases.some(a => a.toLowerCase() === valStr || valStr.includes(a.toLowerCase()))) {
          switch (entity.type) {
            case 'running_style':
              if (!result.runningStyle) result.runningStyle = entity.canonical;
              break;
            case 'distance':
              if (!result.distance) result.distance = entity.canonical;
              break;
            case 'surface':
              if (!result.surface) result.surface = entity.canonical;
              break;
            case 'track':
              if (!result.track) result.track = entity.canonical;
              break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Main reasoning pipeline
   * Connects facts, identifies patterns, compares information, and draws structured conclusions.
   * STRICT CONSTRAINT: Does NOT call tools, execute actions, or route agents.
   */
  public reason(input: string | ReasoningInput): ReasoningResult {
    const params: ReasoningInput = typeof input === 'string' ? { text: input } : input;
    const { text, facts = [], context = {}, previousInteractions = [] } = params;

    // Check cache
    const cacheKey = JSON.stringify({ text, facts: facts.map(f => f.value || f), context });
    const cached = this.cache.get<ReasoningResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // 1. Consistency Analysis (Check for contradictions or conflicts)
    const consistencyResult = this.consistency.check({ text, facts, context });

    // 2. Comparisons
    const comparisons: Comparison[] = [];
    const fanReqMatch = text.match(/require(?:d|ment)?(?:\s*is)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);
    const trainerFanMatch =
      text.match(/trainer\s*(?:has|with)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i) ||
      text.match(/current\s*(?:fans)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);

    let currentFans: number | undefined;
    let requiredFans: number | undefined;

    if (trainerFanMatch && fanReqMatch) {
      currentFans = parseFloat(trainerFanMatch[1]) * 1_000_000;
      requiredFans = parseFloat(fanReqMatch[1]) * 1_000_000;
      comparisons.push(this.comparison.compareRequirement(currentFans, requiredFans, 'Fans'));
    }

    // Check facts for fan values if not found in text
    if (currentFans === undefined || requiredFans === undefined) {
      const curFact = facts.find(f => (f.name || f.key || '').toLowerCase().includes('current'));
      const reqFact = facts.find(f => (f.name || f.key || '').toLowerCase().includes('require'));
      if (curFact && reqFact && typeof curFact.value === 'number' && typeof reqFact.value === 'number') {
        currentFans = curFact.value;
        requiredFans = reqFact.value;
        comparisons.push(this.comparison.compareRequirement(currentFans, requiredFans, 'Fans'));
      }
    }

    // Speed comparison e.g. "Speed 1200", "Speed 1000"
    const speedMatches = Array.from(text.matchAll(/speed\s*[:=]?\s*(\d+)/gi));
    if (speedMatches.length >= 2) {
      const s1 = parseInt(speedMatches[0][1], 10);
      const s2 = parseInt(speedMatches[1][1], 10);
      comparisons.push(this.comparison.compareStats('Speed', s1, s2));
    }

    // Generic numeric comparisons if present
    const vsMatch = text.match(/(\d+(?:\.\d+)?)\s*vs\s*(\d+(?:\.\d+)?)/i);
    if (vsMatch && comparisons.length === 0) {
      comparisons.push(
        this.comparison.compareNumbers(parseFloat(vsMatch[1]), parseFloat(vsMatch[2]))
      );
    }

    // 3. Deductions
    const deductions = this.deduction.deduce({
      currentFans,
      requiredFans,
      facts,
      text
    });

    // 4. Pattern Detection
    const patterns = this.pattern.detect(text, previousInteractions);

    // 5. Taxonomy-Aware Reasoning
    const taxonomy = this.reasonTaxonomy(text, facts);

    // 6. Conclusions (Structured conclusions only - NO action recommendations)
    const conclusions = this.conclusion.conclude({
      currentFans,
      requiredFans,
      facts,
      deductions,
      comparisons,
      text
    });

    // Record reasoning memory patterns
    if (currentFans !== undefined && requiredFans !== undefined) {
      if (currentFans < requiredFans) {
        this.memory.record('goal_gap', 'current < required', 'Fan target gap observed', {
          deficit: requiredFans - currentFans
        });
      } else {
        this.memory.record('goal_achieved', 'current >= required', 'Fan target requirement reached', {
          surplus: currentFans - requiredFans
        });
      }
    }

    // 7. Calculate overall reasoning confidence score
    let confidence = 0.95;
    if (consistencyResult.inconsistent) {
      confidence = 0.45; // Penalized due to contradiction
    } else if (conclusions.length === 0 && deductions.length === 0 && patterns.length === 0) {
      confidence = 0.8;
    } else if (conclusions.length > 0 && deductions.length > 0) {
      confidence = 1.0;
    }

    const result: ReasoningResult = {
      comparisons,
      deductions,
      conclusions,
      patterns,
      consistency: consistencyResult,
      confidence,
      taxonomy: Object.keys(taxonomy).length > 0 ? taxonomy : undefined
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }
}
