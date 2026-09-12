import { CharacterEngine } from './character-engine.js';
import { Tokenizer } from './tokenizer.js';
import { SentenceParser } from './sentence-parser.js';
import { DictionaryService } from './dictionary-service.js';
import { GlossaryService, GlossaryEntry } from './glossary-service.js';
import { ComprehensionEngine } from './comprehension-engine.js';
import { WritingEngine, WritingResult } from './writing/index.js';
import { Token } from './models/token.js';
import { Sentence } from './models/sentence.js';
import { NormalizationEngine } from './normalization/normalization-engine.js';
import { CorrectionResult } from './normalization/typo-correction-service.js';
import { UnknownWordTracker } from './dictionary/unknown-word-tracker.js';
import { ReadingComprehensionEngine, ComprehensionResult as RichComprehensionResult } from './comprehension/index.js';
import { UnderstandingEngine, UnderstandingResult, ContextState } from './understanding/index.js';
import { CommunicationEngine, CommunicationResult } from './communication/index.js';
import { ReasoningEngine, ReasoningResult } from './reasoning/index.js';
import { LearningEngine, LearningResult } from './learning/index.js';

export interface LanguageCoreResult {
  originalText: string;
  normalizedText: string;
  tokens: Token[];
  sentences: Sentence[];
  entities: string[];
  unknownWords: string[];
  confidence: number;
  corrections?: CorrectionResult[];
  needsClarification?: boolean;
  glossaryTerms?: GlossaryEntry[];
  detectedDomains?: string[];
  comprehension?: RichComprehensionResult;
  writing?: WritingResult;
  understanding?: UnderstandingResult;
  communication?: CommunicationResult;
  reasoning?: ReasoningResult;
  learning?: LearningResult;
}

export class LanguageCoreService {
  private characterEngine = new CharacterEngine();
  private tokenizer = new Tokenizer();
  private sentenceParser = new SentenceParser();
  private dictionaryService = new DictionaryService();
  private glossaryService = new GlossaryService();
  private comprehensionEngine = new ComprehensionEngine();
  private richComprehensionEngine = new ReadingComprehensionEngine(this.glossaryService);
  private writingEngine = new WritingEngine(this.glossaryService);
  private understandingEngine = new UnderstandingEngine();
  private communicationEngine = new CommunicationEngine();
  private reasoningEngine = new ReasoningEngine();
  private learningEngine = new LearningEngine();
  private normalizationEngine = new NormalizationEngine();
  private unknownWordTracker = new UnknownWordTracker();
  private lastContextState: ContextState = {};

  public getLearningEngine(): LearningEngine {
    return this.learningEngine;
  }

  public getReasoningEngine(): ReasoningEngine {
    return this.reasoningEngine;
  }

  public getCommunicationEngine(): CommunicationEngine {
    return this.communicationEngine;
  }

  public getUnderstandingEngine(): UnderstandingEngine {
    return this.understandingEngine;
  }

  public getUnknownWordTracker(): UnknownWordTracker {
    return this.unknownWordTracker;
  }

  public getDictionaryService(): DictionaryService {
    return this.dictionaryService;
  }

  public async analyze(text: string): Promise<LanguageCoreResult> {
    const originalText = text;
    
    // Step 0: Run Normalization Engine (Typos, Aliases, OCR, Ambiguity)
    const normResult = this.normalizationEngine.normalize(text);
    if (normResult.needsClarification) {
      return {
        originalText,
        normalizedText: text,
        tokens: [],
        sentences: [],
        entities: [],
        unknownWords: [],
        confidence: 0.0,
        corrections: [],
        needsClarification: true,
        glossaryTerms: [],
        detectedDomains: []
      };
    }

    const normalizedText = this.writingEngine.cleanText(normResult.normalizedText);

    // Step 2: Character Analysis via CharacterEngine
    const charAnalysis = this.characterEngine.analyze(normalizedText);

    // Step 3: Tokenize
    const tokens = this.tokenizer.tokenize(normalizedText);

    // Step 4: Parse Sentences
    const sentences = this.sentenceParser.parse(normalizedText);

    // Step 5: Entity Identification via Glossary
    const glossaryMatches = this.glossaryService.matchTerms(normalizedText);
    const entities = glossaryMatches.map(g => g.term);
    const detectedDomains = this.glossaryService.detectDomains(normalizedText);

    // Step 6: Identify unknown words via Dictionary lookup
    const unknownWords: string[] = [];
    for (const token of tokens) {
      const cleanWord = token.text;
      // Skip symbols & numbers & glossary term parts to keep unknown words relevant
      if (/^[a-z]+$/.test(cleanWord)) {
        const isGlossaryPart = entities.some(ent => ent.toLowerCase().includes(cleanWord));
        if (!this.dictionaryService.hasWord(cleanWord) && !isGlossaryPart) {
          unknownWords.push(token.originalText);
          this.unknownWordTracker.track(cleanWord);
        }
      }
    }

    // Step 7: Comprehension Analysis
    const comprehension = this.comprehensionEngine.comprehend(normalizedText);
    const richComprehension = this.richComprehensionEngine.comprehend(normalizedText);

    // Step 8: Writing Generation (F6 Integration)
    const topic = richComprehension.context?.currentFans !== undefined || richComprehension.context?.requiredFans !== undefined
      ? "Fan Requirement"
      : (richComprehension.context?.event || "General Training");
    const tone = richComprehension.context?.emotion === "concern" ? "Coach" : "Friendly";
    const style = "Conversation";

    const writingResult = this.writingEngine.generate({
      topic,
      facts: richComprehension.facts,
      entities: richComprehension.entities,
      audience: "Trainer",
      style,
      tone
    });

    // Step 9: Understanding Intelligence (F7 Integration)
    if (normalizedText.toLowerCase().includes('oguri')) {
      this.lastContextState.lastMentionedCharacter = 'Oguri Cap';
    } else if (normalizedText.toLowerCase().includes('kitasan')) {
      this.lastContextState.lastMentionedCharacter = 'Kitasan Black';
    }
    if (normalizedText.toLowerCase().includes('arima')) {
      this.lastContextState.lastMentionedEvent = 'Arima Kinen';
    }

    const understandingResult = this.understandingEngine.understand(
      normalizedText,
      richComprehension.facts,
      richComprehension.entities,
      this.lastContextState
    );

    // Step 10: Communication Intelligence (F8 Integration)
    const glossaryTermNames = glossaryMatches.map(g => g.term);
    const communicationResult = this.communicationEngine.communicate({
      sessionId: 'default-session',
      text: normalizedText,
      goal: understandingResult.goal,
      emotion: understandingResult.emotion,
      glossaryTerms: glossaryTermNames,
      clarificationNeeded: understandingResult.clarificationNeeded,
      clarification: understandingResult.clarification
    });

    // Step 11: Reasoning Intelligence (F9 Integration)
    const reasoningResult = this.reasoningEngine.reason({
      text: normalizedText,
      facts: richComprehension.facts,
      entities: richComprehension.entities,
      context: {
        ...richComprehension.context,
        goal: understandingResult.goal,
        emotion: understandingResult.emotion,
        communicationStyle: communicationResult.style
      }
    });

    // Step 12: Learning Observation & Candidate Generation (F10 Integration)
    const learningResult = this.learningEngine.process({
      text: normalizedText,
      unknownWords: Array.from(new Set(unknownWords)),
      entities: richComprehension.entities,
      facts: richComprehension.facts,
      context: {
        ...richComprehension.context,
        goal: understandingResult.goal
      }
    });

    return {
      originalText,
      normalizedText,
      tokens,
      sentences,
      entities,
      unknownWords: Array.from(new Set(unknownWords)),
      confidence: comprehension.confidence,
      corrections: normResult.corrections,
      glossaryTerms: glossaryMatches,
      detectedDomains,
      comprehension: richComprehension,
      writing: writingResult,
      understanding: understandingResult,
      communication: communicationResult,
      reasoning: reasoningResult,
      learning: learningResult
    };
  }
}
