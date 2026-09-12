import { LexicalQuery } from './lexical-query.js';
import { LexicalResult } from './lexical-result.js';
import { LexicalRouter } from './lexical-router.js';
import { LexicalContextResolver } from './lexical-context.js';
import { LexicalConfidenceAggregator } from './lexical-confidence.js';
import { LexicalCache } from './lexical-cache.js';
import { LilyVocabularyProvider } from '../../vocabulary/lily-vocabulary-provider.js';
import { DictionaryKnowledgeProvider } from '../../vocabulary/dictionary/dictionary-provider.js';
import { LilySynonymEngine } from '../../vocabulary/synonyms/synonym-engine.js';
import { LilyAntonymEngine } from '../../vocabulary/antonyms/antonym-engine.js';
import { DefinitionKnowledgeProvider } from '../../vocabulary/definitions/definition-provider.js';
import { VocabularyLearningEngine } from '../../vocabulary/learning/vocabulary-learning-engine.js';

export interface LexicalOrchestratorDependencies {
  vocabularyProvider?: LilyVocabularyProvider;
  dictionaryProvider?: DictionaryKnowledgeProvider;
  synonymEngine?: LilySynonymEngine;
  antonymEngine?: LilyAntonymEngine;
  definitionProvider?: DefinitionKnowledgeProvider;
  learningEngine?: VocabularyLearningEngine;
}

export class LexicalOrchestrator {
  private vocabularyProvider: LilyVocabularyProvider;
  private dictionaryProvider: DictionaryKnowledgeProvider;
  private synonymEngine: LilySynonymEngine;
  private antonymEngine: LilyAntonymEngine;
  private definitionProvider: DefinitionKnowledgeProvider;
  private learningEngine: VocabularyLearningEngine;

  private router: LexicalRouter;
  private contextResolver: LexicalContextResolver;
  private confidenceAggregator: LexicalConfidenceAggregator;
  private cache: LexicalCache;

  constructor(deps?: LexicalOrchestratorDependencies) {
    this.vocabularyProvider = deps?.vocabularyProvider || new LilyVocabularyProvider();
    this.dictionaryProvider = deps?.dictionaryProvider || new DictionaryKnowledgeProvider();
    this.synonymEngine = deps?.synonymEngine || new LilySynonymEngine();
    this.antonymEngine = deps?.antonymEngine || new LilyAntonymEngine();
    this.definitionProvider = deps?.definitionProvider || new DefinitionKnowledgeProvider();
    this.learningEngine = deps?.learningEngine || new VocabularyLearningEngine();

    this.router = new LexicalRouter();
    this.contextResolver = new LexicalContextResolver();
    this.confidenceAggregator = new LexicalConfidenceAggregator();
    this.cache = new LexicalCache();
  }

  public getRouter(): LexicalRouter {
    return this.router;
  }

  public getCache(): LexicalCache {
    return this.cache;
  }

  public getContextResolver(): LexicalContextResolver {
    return this.contextResolver;
  }

  public getConfidenceAggregator(): LexicalConfidenceAggregator {
    return this.confidenceAggregator;
  }

  public getVocabularyProvider(): LilyVocabularyProvider {
    return this.vocabularyProvider;
  }

  public getDictionaryProvider(): DictionaryKnowledgeProvider {
    return this.dictionaryProvider;
  }

  public getSynonymEngine(): LilySynonymEngine {
    return this.synonymEngine;
  }

  public getAntonymEngine(): LilyAntonymEngine {
    return this.antonymEngine;
  }

  public getDefinitionProvider(): DefinitionKnowledgeProvider {
    return this.definitionProvider;
  }

  public getLearningEngine(): VocabularyLearningEngine {
    return this.learningEngine;
  }

  /**
   * Main Orchestration Pipeline:
   * Input -> Routing -> Vocabulary -> Dictionary -> Synonym -> Antonym -> Phrase -> Definition -> Learning -> Result
   */
  public orchestrate(rawQuery: LexicalQuery | string): LexicalResult {
    const query: LexicalQuery = typeof rawQuery === 'string'
      ? { text: rawQuery }
      : rawQuery;

    const text = query.text.trim();
    if (!text) {
      return {
        term: '',
        confidence: 0,
        source: 'empty_query'
      };
    }

    // 1. Cache Check
    const cached = this.cache.get(query);
    if (cached) {
      return cached;
    }

    const normalized = text.toLowerCase();
    const routeDecision = this.router.route(query);

    const sources: string[] = [];
    let foundAny = false;

    let partOfSpeech: string | undefined;
    let definition: string | undefined;
    let definitions: string[] = [];
    let synonyms: string[] = [];
    let antonyms: string[] = [];
    let phraseMeaning: string | undefined = routeDecision.phraseMeaning;
    let isPhrase = routeDecision.isMultiWord || routeDecision.isIdiomOrPhrase;
    let phraseExpansions: string[] = [];
    let oppositePhrases: string[] = [];
    let candidate = false;
    let candidateInfo: unknown = undefined;

    let dictConf: number | undefined;
    let defConf: number | undefined;
    let synConf: number | undefined;
    let antConf: number | undefined;
    let vocabConf: number | undefined;
    let phraseConf: number | undefined;

    // Subsystem 1: Phrase Engine / Idiom Match
    if (routeDecision.phraseMeaning) {
      phraseMeaning = routeDecision.phraseMeaning;
      sources.push('phrase');
      foundAny = true;
      phraseConf = 0.95;
      if (!definition) definition = phraseMeaning;
    }

    // Subsystem 2: Dictionary Provider Lookup
    if (this.dictionaryProvider.exists(normalized)) {
      const dictLookup = this.dictionaryProvider.lookup(normalized);
      if (dictLookup.found && dictLookup.entry) {
        sources.push('dictionary');
        foundAny = true;
        dictConf = dictLookup.confidence || 0.95;
        partOfSpeech = dictLookup.entry.partOfSpeech;
        if (dictLookup.entry.definitions && dictLookup.entry.definitions.length > 0) {
          definitions.push(...dictLookup.entry.definitions);
        }
      }
    }

    // Subsystem 3: Core Vocabulary Provider Lookup
    const vocabEntry = this.vocabularyProvider.lookupWord(normalized);
    if (vocabEntry) {
      sources.push('vocabulary');
      foundAny = true;
      vocabConf = 0.92;
      if (!partOfSpeech) partOfSpeech = vocabEntry.partOfSpeech;
      if (vocabEntry.definition && !definitions.includes(vocabEntry.definition)) {
        definitions.push(vocabEntry.definition);
      }
    }

    // Subsystem 4: Definition Knowledge Provider Lookup
    if (this.definitionProvider.exists(normalized)) {
      const defLookup = this.definitionProvider.lookupDefinition(normalized, { context: query.context });
      if (defLookup.found) {
        sources.push('definition');
        foundAny = true;
        defConf = defLookup.confidence || 0.92;
        if (!partOfSpeech && defLookup.selectedDefinition?.partOfSpeech) {
          partOfSpeech = defLookup.selectedDefinition.partOfSpeech;
        }
        if (defLookup.bestDefinition && !definitions.includes(defLookup.bestDefinition)) {
          definitions.push(defLookup.bestDefinition);
        } else if (defLookup.selectedDefinition?.definition && !definitions.includes(defLookup.selectedDefinition.definition)) {
          definitions.push(defLookup.selectedDefinition.definition);
        }
        for (const d of defLookup.definitions) {
          if (d.definition && !definitions.includes(d.definition)) {
            definitions.push(d.definition);
          }
        }
      }
    }

    // Subsystem 5: Synonym Engine
    const synList = this.synonymEngine.findSynonyms(normalized);
    if (synList && synList.length > 0) {
      sources.push('synonyms');
      foundAny = true;
      synConf = 0.90;
      synonyms = synList;
    }

    // Subsystem 6: Antonym Engine
    const antList = this.antonymEngine.findAntonyms(normalized);
    if (antList && antList.length > 0) {
      sources.push('antonyms');
      foundAny = true;
      antConf = 0.88;
      antonyms = antList;
    }

    // Multi-word phrase expansions & opposites
    if (isPhrase || normalized.includes(' ')) {
      const synExpansion = this.synonymEngine.expand(normalized);
      if (synExpansion.expandedPhrases && synExpansion.expandedPhrases.length > 0) {
        phraseExpansions = synExpansion.expandedPhrases;
      }
      const antExpansion = this.antonymEngine.expandOpposites(normalized);
      if (antExpansion.oppositePhrases && antExpansion.oppositePhrases.length > 0) {
        oppositePhrases = antExpansion.oppositePhrases;
      }
    }

    // Subsystem 7: Context Resolution (Pick best definition for the given context)
    if (definitions.length > 0) {
      const resolved = this.contextResolver.resolveContext(normalized, query.context, definitions);
      definition = resolved.bestDefinition || definitions[0];
    }

    // Subsystem 8: Unknown Word / Learning Engine Flow
    if (!foundAny && !phraseMeaning) {
      // Pass unknown term to Vocabulary Learning Engine
      const candidates = this.learningEngine.observe(normalized);
      candidate = true;
      sources.push('learning');
      const candidateEntry = this.learningEngine.getCandidates().find(c => c.term === normalized);
      if (candidateEntry) {
        candidateInfo = candidateEntry;
      } else if (candidates.length > 0) {
        candidateInfo = candidates[0];
      }
    }

    // Calculate aggregated confidence & semantic score
    const finalConfidence = this.confidenceAggregator.aggregate({
      dictionary: dictConf,
      definition: defConf,
      synonym: synConf,
      antonym: antConf,
      phrase: phraseConf,
      vocabulary: vocabConf,
      isExact: foundAny,
      isCandidate: candidate,
      subsystemCount: sources.length
    });

    const semanticScore = this.confidenceAggregator.calculateSemanticScore(
      dictConf !== undefined || vocabConf !== undefined,
      defConf !== undefined || definitions.length > 0,
      Boolean(query.context),
      synonyms.length > 0,
      candidate
    );

    const primarySource = sources[0] || (candidate ? 'learning' : 'lexical');

    const result: LexicalResult = {
      term: text,
      normalizedTerm: normalized,
      definition,
      definitions: definitions.length > 0 ? definitions : undefined,
      partOfSpeech,
      synonyms: synonyms.length > 0 ? synonyms : undefined,
      antonyms: antonyms.length > 0 ? antonyms : undefined,
      phraseMeaning,
      isPhrase,
      phraseExpansions: phraseExpansions.length > 0 ? phraseExpansions : undefined,
      oppositePhrases: oppositePhrases.length > 0 ? oppositePhrases : undefined,
      candidate: candidate ? true : undefined,
      candidateInfo: candidateInfo as any,
      confidence: finalConfidence,
      source: primarySource,
      subsystem: routeDecision.primaryRoute,
      sources,
      context: query.context,
      semanticScore
    };

    // Store in cache
    this.cache.set(query, result);

    return result;
  }
}
