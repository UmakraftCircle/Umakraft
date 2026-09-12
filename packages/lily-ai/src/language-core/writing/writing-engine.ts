import { Fact } from '../comprehension/fact-detector.js';
import { Entity } from '../comprehension/reading-comprehension-engine.js';
import { TemplateEngine, WritingContext } from './template-engine.js';
import { StyleEngine } from './style-engine.js';
import { ToneEngine } from './tone-engine.js';
import { SentenceBuilder } from './sentence-builder.js';
import { ParagraphBuilder } from './paragraph-builder.js';
import { Formatter } from './formatter.js';
import { ExplanationEngine } from './explanation-engine.js';
import { Summarizer } from './summarizer.js';
import { GlossaryService } from '../glossary-service.js';

export interface WritingResult {
  text: string;
  style: string;
  tone: string;
  confidence: number;
}

export class WritingEngine {
  private templateEngine = new TemplateEngine();
  private styleEngine = new StyleEngine();
  private toneEngine = new ToneEngine();
  private sentenceBuilder = new SentenceBuilder();
  private paragraphBuilder = new ParagraphBuilder();
  private formatter = new Formatter();
  private explanationEngine: ExplanationEngine;
  private summarizer = new Summarizer();

  constructor(glossaryService: GlossaryService) {
    this.explanationEngine = new ExplanationEngine(glossaryService);
  }

  /**
   * Main generation pipeline: template -> tone -> style
   */
  public generate(context: WritingContext): WritingResult {
    // 1. Render core message using TemplateEngine
    let coreText = this.templateEngine.render(context);

    // 2. Adapt the phrasing with ToneEngine
    let tonedText = this.toneEngine.applyTone(coreText, context.tone);

    // 3. Format the final layout using StyleEngine
    let styledText = this.styleEngine.applyStyle(tonedText, context.style);

    return {
      text: styledText,
      style: context.style,
      tone: context.tone,
      confidence: 0.95
    };
  }

  // Delegate helpers to sub-engines to expose complete capability set
  public getSentenceBuilder(): SentenceBuilder {
    return this.sentenceBuilder;
  }

  public getParagraphBuilder(): ParagraphBuilder {
    return this.paragraphBuilder;
  }

  public getFormatter(): Formatter {
    return this.formatter;
  }

  public getExplanationEngine(): ExplanationEngine {
    return this.explanationEngine;
  }

  public getSummarizer(): Summarizer {
    return this.summarizer;
  }

  /**
   * Cleans and normalizes whitespace in the text (backward compatibility)
   */
  public normalizeWhitespace(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalizes different punctuation styles to standard equivalents (backward compatibility)
   */
  public normalizePunctuation(text: string): string {
    return text
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/\u2014/g, '-')
      .replace(/\.{3,}/g, '...');
  }

  /**
   * Full normalizer sequence (backward compatibility)
   */
  public cleanText(text: string): string {
    return this.normalizeWhitespace(this.normalizePunctuation(text));
  }
}
export type { WritingContext };
