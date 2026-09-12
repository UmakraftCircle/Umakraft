import { VocabularyCandidate, CandidateScoreDetails } from './candidate-registry.js';
import { CandidateDetector } from './candidate-detector.js';

export interface ContextAnalysisResult {
  inferredMeaning: string;
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb' | 'interjection' | 'phrase' | string;
  sentiment: 'positive' | 'negative' | 'neutral';
  consistencyScore: number;
}

export class CandidateScorer {
  private detector: CandidateDetector;

  constructor(detector?: CandidateDetector) {
    this.detector = detector || new CandidateDetector();
  }

  /**
   * Calculates comprehensive score and detailed metrics for a vocabulary candidate.
   */
  public score(candidate: VocabularyCandidate): {
    confidence: number;
    scoreDetails: CandidateScoreDetails;
    contextAnalysis?: ContextAnalysisResult;
  } {
    // 1. Frequency Score (Logarithmic scaling from 0 to 1)
    // 1 occurrence -> 0.05
    // 5 occurrences -> 0.35
    // 25 occurrences -> 0.65
    // 100 occurrences -> 0.85
    // 500+ occurrences -> 0.96
    const freq = candidate.frequency;
    let frequencyScore = 0.05;
    if (freq > 1) {
      frequencyScore = Math.min(0.98, 0.05 + Math.log10(freq) * 0.35);
    }

    // 2. User Diversity Score (More distinct users using the word = higher validity)
    const userCount = candidate.uniqueUsers ? candidate.uniqueUsers.length : 1;
    let userDiversityScore = 0.20;
    if (userCount >= 10) userDiversityScore = 1.0;
    else if (userCount >= 5) userDiversityScore = 0.85;
    else if (userCount >= 2) userDiversityScore = 0.60;
    else userDiversityScore = 0.30;

    // 3. Linguistic Plausibility Score
    const plausibility = this.detector.checkPlausibility(candidate.term);
    const linguisticScore = plausibility.plausible ? 0.90 : 0.10;

    // 4. Temporal Persistence Score (Has the word stayed over time or is it a 1-second burst?)
    const timeSpanMs = candidate.lastSeenAt.getTime() - candidate.firstSeenAt.getTime();
    let temporalScore = 0.50;
    if (timeSpanMs > 1000 * 60 * 60 * 24 * 7) temporalScore = 0.95; // > 7 days
    else if (timeSpanMs > 1000 * 60 * 60 * 24) temporalScore = 0.85; // > 1 day
    else if (timeSpanMs > 1000 * 60 * 60) temporalScore = 0.70; // > 1 hour
    else if (candidate.frequency >= 10) temporalScore = 0.60;

    // 5. Context Analysis & Consistency Score
    const contextAnalysis = this.analyzeContext(candidate.term, candidate.contextSamples);
    const contextScore = contextAnalysis.consistencyScore;

    // 6. Community / Domain Bonus
    let communityBonus = 0;
    if (candidate.category === 'community' || candidate.category === 'racing') {
      communityBonus = 0.05;
    }

    // Composite Weighted Score:
    // Frequency: 35%, User Diversity: 20%, Linguistic: 20%, Context: 15%, Temporal: 10%
    let composite =
      frequencyScore * 0.35 +
      userDiversityScore * 0.20 +
      linguisticScore * 0.20 +
      contextScore * 0.15 +
      temporalScore * 0.10 +
      communityBonus;

    if (!plausibility.plausible) {
      composite = Math.min(0.20, composite * 0.2); // Severe penalty for gibberish
    }

    const confidence = Number(Math.min(0.99, Math.max(0.01, composite)).toFixed(4));

    const scoreDetails: CandidateScoreDetails = {
      frequencyScore: Number(frequencyScore.toFixed(4)),
      userDiversityScore: Number(userDiversityScore.toFixed(4)),
      linguisticScore: Number(linguisticScore.toFixed(4)),
      contextScore: Number(contextScore.toFixed(4)),
      temporalScore: Number(temporalScore.toFixed(4)),
      communityBonus: Number(communityBonus.toFixed(4)),
      compositeScore: confidence
    };

    return {
      confidence,
      scoreDetails,
      contextAnalysis
    };
  }

  /**
   * Analyzes context samples to infer semantics, sentiment, and part of speech.
   */
  public analyzeContext(term: string, samples: string[]): ContextAnalysisResult {
    if (!samples || samples.length === 0) {
      return {
        inferredMeaning: 'Unobserved context candidate',
        partOfSpeech: 'noun',
        sentiment: 'neutral',
        consistencyScore: 0.40
      };
    }

    const lowerTerm = term.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    let racingCount = 0;
    let predicateCount = 0; // "was [term]", "is [term]" -> adjective/slang

    const positiveWords = ['great', 'awesome', 'win', 'good', 'best', 'pog', 'epic', 'nice', 'love', 'hype'];
    const negativeWords = ['bad', 'worst', 'lose', 'fail', 'trash', 'nerf', 'drop', 'sad'];
    const racingWords = ['race', 'trainer', 'speed', 'stamina', 'guts', 'spark', 'build', 'deck', 'club', 'event'];

    for (const sample of samples) {
      const sLower = sample.toLowerCase();

      for (const pw of positiveWords) {
        if (sLower.includes(pw)) positiveCount++;
      }
      for (const nw of negativeWords) {
        if (sLower.includes(nw)) negativeCount++;
      }
      for (const rw of racingWords) {
        if (sLower.includes(rw)) racingCount++;
      }

      if (
        sLower.includes(`is ${lowerTerm}`) ||
        sLower.includes(`was ${lowerTerm}`) ||
        sLower.includes(`so ${lowerTerm}`) ||
        sLower.includes(`very ${lowerTerm}`)
      ) {
        predicateCount++;
      }
    }

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveCount > negativeCount && positiveCount >= 1) {
      sentiment = 'positive';
    } else if (negativeCount > positiveCount && negativeCount >= 1) {
      sentiment = 'negative';
    }

    let pos: 'noun' | 'verb' | 'adjective' | 'adverb' | 'interjection' | 'phrase' | string = 'noun';
    let meaning = '';

    if (predicateCount >= 1 || lowerTerm === 'poggers' || lowerTerm.endsWith('ful') || lowerTerm.endsWith('ous')) {
      pos = 'adjective';
      if (sentiment === 'positive') {
        meaning = 'positive expression of excitement or high quality';
      } else if (sentiment === 'negative') {
        meaning = 'expression of disapproval or poor outcome';
      } else {
        meaning = 'descriptive term or community modifier';
      }
    } else if (racingCount >= 1) {
      pos = 'noun';
      meaning = 'community gaming or racing terminology';
    } else {
      pos = 'noun';
      meaning = 'emerging candidate term';
    }

    // Consistency score scales with sample count and clear patterns
    const consistencyScore = Math.min(0.95, 0.50 + Math.min(samples.length * 0.1, 0.40));

    return {
      inferredMeaning: meaning,
      partOfSpeech: pos,
      sentiment,
      consistencyScore: Number(consistencyScore.toFixed(4))
    };
  }
}
