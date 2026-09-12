import { test } from 'node:test';
import assert from 'node:assert';
import {
  LanguageCoreService,
  ReasoningEngine,
  ComparisonEngine,
  CalculationEngine,
  DeductionEngine,
  PatternEngine,
  ConsistencyEngine,
  ConclusionEngine,
  ReasoningMemory
} from '../../packages/lily-ai/src/language-core/index.js';

test('F9 — Reasoning Foundation Engine', async (t) => {
  const reasoningEngine = new ReasoningEngine();
  const coreService = new LanguageCoreService();

  await t.test('1. Comparisons', () => {
    const compEngine = reasoningEngine.getComparisonEngine();

    // 150M > 120M requirement comparison
    const reqComp = compEngine.compareRequirement(120_000_000, 150_000_000, 'Fans');
    assert.strictEqual(reqComp.difference, 30_000_000);
    assert.strictEqual(reqComp.status, 'below_requirement');
    assert.strictEqual(reqComp.higher, 150_000_000);
    assert.strictEqual(reqComp.lower, 120_000_000);

    // Speed 1200 vs Speed 1000
    const statComp = compEngine.compareStats('Speed', 1200, 1000);
    assert.strictEqual(statComp.higher, 1200);
    assert.strictEqual(statComp.lower, 1000);
    assert.strictEqual(statComp.difference, 200);
    assert.strictEqual(statComp.status, 'greater');

    // General number comparison
    const numComp = compEngine.compareNumbers(50, 80);
    assert.strictEqual(numComp.difference, 30);
    assert.strictEqual(numComp.status, 'less');

    // ReasoningEngine backward-compatible compare & difference
    assert.strictEqual(reasoningEngine.compare(150, 120), 'GREATER');
    assert.strictEqual(reasoningEngine.difference(150, 120), 30);
  });

  await t.test('2. Calculations', () => {
    const calc = reasoningEngine.getCalculationEngine();

    // Arithmetic
    assert.strictEqual(calc.add(120, 30).result, 150);
    assert.strictEqual(calc.subtract(150, 120).result, 30);
    assert.strictEqual(calc.multiply(10, 15).result, 150);
    assert.strictEqual(calc.divide(150, 5).result, 30);
    assert.strictEqual(calc.divide(100, 0).result, 0); // Safe division by zero

    // Percentages & Ratios
    assert.strictEqual(calc.percentage(30, 150).result, 20);
    assert.strictEqual(calc.ratio(300, 100).result, 3);

    // Progress
    const prog = calc.progress(120_000_000, 150_000_000);
    assert.strictEqual(prog.progress, 80);
    assert.strictEqual(prog.formatted, '80%');
  });

  await t.test('3. Deductions', () => {
    const deductionEngine = reasoningEngine.getDeductionEngine();

    // Trainer has 180M fans, requirement is 150M
    const deductionMet = deductionEngine.deduceFanRequirement(180_000_000, 150_000_000);
    assert.strictEqual(deductionMet.requirementMet, true);

    // Trainer has 120M fans, requirement is 150M
    const deductionUnmet = deductionEngine.deduceFanRequirement(120_000_000, 150_000_000);
    assert.strictEqual(deductionUnmet.requirementMet, false);

    // Long distance race with 350 stamina
    const staminaIssue = deductionEngine.deduceStaminaSufficiency('Long Distance', 350);
    assert.strictEqual(staminaIssue.possibleIssue, 'insufficient_stamina');
    assert.strictEqual(staminaIssue.requirementMet, false);

    // Context deduction
    const ctxDeductions = deductionEngine.deduceFromContext(
      [],
      'She is entering a long distance race with 350 stamina.'
    );
    assert.ok(ctxDeductions.some(d => d.possibleIssue === 'insufficient_stamina'));
  });

  await t.test('4. Pattern detection', () => {
    const patternEngine = reasoningEngine.getPatternEngine();

    // Lost 5 long-distance races
    const lossPatterns = patternEngine.detect('Lost 5 long-distance races');
    assert.ok(lossPatterns.length > 0);
    assert.strictEqual(lossPatterns[0].category, 'long_distance_losses');
    assert.strictEqual(lossPatterns[0].count, 5);

    // Repeated Front Runner searches
    const stratPatterns = patternEngine.detect('Repeated Front Runner searches');
    assert.ok(stratPatterns.length > 0);
    assert.strictEqual(stratPatterns[0].interest, 'front_runner');

    // Multi-turn continuity
    const historyPatterns = patternEngine.detect('General query', [{ id: 1 }, { id: 2 }]);
    assert.ok(historyPatterns.some(p => p.patternType === 'session_frequency'));
  });

  await t.test('5. Consistency checks', () => {
    const consistencyEngine = reasoningEngine.getConsistencyEngine();

    // Contradictory fan counts
    const fansContradiction = consistencyEngine.check('Current Fans: 120M\nCurrent Fans: 150M');
    assert.strictEqual(fansContradiction.inconsistent, true);
    assert.strictEqual(fansContradiction.consistent, false);

    // Conflicting surfaces
    const surfaceConflict = consistencyEngine.check('Surface: Turf\nSurface: Dirt');
    assert.strictEqual(surfaceConflict.conflict, true);
    assert.strictEqual(surfaceConflict.inconsistent, true);
    assert.strictEqual(surfaceConflict.consistent, false);

    // Completely consistent input
    const consistentInput = consistencyEngine.check('Current Fans: 120M\nRequired Fans: 150M\nSurface: Turf');
    assert.strictEqual(consistentInput.consistent, true);
    assert.strictEqual(consistentInput.inconsistent, false);
    assert.strictEqual(consistentInput.issues.length, 0);
  });

  await t.test('6. Conclusions', () => {
    const conclusionEngine = reasoningEngine.getConclusionEngine();

    // Goal not reached
    const unmet = conclusionEngine.concludeFanTarget(120_000_000, 150_000_000);
    assert.strictEqual(unmet.remainingFans, 30_000_000);
    assert.strictEqual(unmet.remaining, 30_000_000);
    assert.strictEqual(unmet.goalReached, false);
    assert.strictEqual(unmet.requirementMet, false);

    // Goal reached
    const met = conclusionEngine.concludeFanTarget(180_000_000, 150_000_000);
    assert.strictEqual(met.remaining, 0);
    assert.strictEqual(met.surplus, 30_000_000);
    assert.strictEqual(met.goalReached, true);
    assert.strictEqual(met.requirementMet, true);

    // Verify: conclusions state facts, not coaching advice or action execution
    assert.ok(!unmet.statement.toLowerCase().includes('go race'));
    assert.ok(!unmet.statement.toLowerCase().includes('you should'));
  });

  await t.test('7. Taxonomy reasoning', () => {
    const taxonomy = reasoningEngine.reasonTaxonomy(
      'Running Style: Front Runner. Race: Long Distance on Turf.'
    );
    assert.strictEqual(taxonomy.runningStyle, 'Front Runner');
    assert.strictEqual(taxonomy.distance, 'Long');
    assert.strictEqual(taxonomy.surface, 'Turf');

    // Alias mapping (e.g. Japanese terms)
    const aliasTaxonomy = reasoningEngine.reasonTaxonomy('Looking for senko build on dirt.');
    assert.strictEqual(aliasTaxonomy.runningStyle, 'Pace Chaser');
    assert.strictEqual(aliasTaxonomy.surface, 'Dirt');
  });

  await t.test('8. Confidence scoring', () => {
    // Normal consistent input yields high confidence
    const normalResult = reasoningEngine.reason({
      text: 'Current: 120M. Required is 150M.',
      facts: []
    });
    assert.ok(normalResult.confidence >= 0.9);

    // Contradictory input penalizes confidence
    const contradictionResult = reasoningEngine.reason({
      text: 'Current Fans: 120M. Current Fans: 150M.',
      facts: []
    });
    assert.ok(contradictionResult.confidence < 0.6);
    assert.strictEqual(contradictionResult.consistency.inconsistent, true);
  });

  await t.test('9. Reasoning memory', () => {
    const memory = reasoningEngine.getReasoningMemory();

    // Default seeded reasoning pattern
    assert.ok(memory.has('goal_gap'));
    const gapTemplate = memory.get('goal_gap');
    assert.strictEqual(gapTemplate?.condition, 'current < required');

    // Record custom pattern
    memory.record('custom_stat_check', 'speed > 1000', 'High speed baseline');
    assert.ok(memory.has('custom_stat_check'));
    assert.strictEqual(memory.get('custom_stat_check')?.frequency, 1);

    // Repeated recording increments frequency
    memory.record('custom_stat_check', 'speed > 1000', 'Updated description');
    assert.strictEqual(memory.get('custom_stat_check')?.frequency, 2);

    // Find pattern by condition
    const found = memory.findPattern('current < required');
    assert.strictEqual(found?.type, 'goal_gap');
  });

  await t.test('10. LanguageCore integration', async () => {
    assert.ok(coreService.getReasoningEngine() instanceof ReasoningEngine);

    const result = await coreService.analyze(
      'Trainer has 120M fans. Requirement is 150M. She lost 5 long-distance races.'
    );

    assert.ok(result.reasoning, 'LanguageCoreResult should include reasoning property');
    assert.ok(Array.isArray(result.reasoning.comparisons));
    assert.ok(Array.isArray(result.reasoning.deductions));
    assert.ok(Array.isArray(result.reasoning.conclusions));
    assert.ok(Array.isArray(result.reasoning.patterns));
    assert.ok(result.reasoning.consistency);
    assert.strictEqual(typeof result.reasoning.confidence, 'number');

    // Validate fan requirement reasoning in full pipeline
    const fanConclusion = result.reasoning.conclusions.find(c => c.type === 'fan_target');
    assert.ok(fanConclusion);
    assert.strictEqual(fanConclusion.remaining, 30_000_000);
    assert.strictEqual(fanConclusion.goalReached, false);

    // Validate pattern detected in full pipeline
    const lossPattern = result.reasoning.patterns.find(p => p.category === 'long_distance_losses');
    assert.ok(lossPattern);
    assert.strictEqual(lossPattern.count, 5);
  });
});
