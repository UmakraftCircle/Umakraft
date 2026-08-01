/**
 * Prompt Template Rendering Tests
 *
 * Verifies that every userTemplate correctly injects variables so that
 * real data reaches the AI prompt.  Guards against the ${'{var}'}
 * anti-pattern where a template literal drops the dollar sign:
 *
 *   ❌ ${'{timeOfDay}'}  →  produces {timeOfDay}  (no $)
 *      → replaceAll('${timeOfDay}', ...) never matches
 *      → real data never reaches the AI
 *
 *   ✅ ${'${timeOfDay}'} →  produces ${timeOfDay} (with $)
 *      → replaceAll('${timeOfDay}', ...) matches
 *
 *   ✅ vars.timeSlot     →  uses vars parameter directly
 *      → no replaceAll needed
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

/** Matches brace-wrapped word WITHOUT a leading dollar: {foo} but not ${foo} */
const BAREBRACE_RE = /(?<!\$)\{[a-zA-Z_]+\}/;

/** Matches a proper placeholder: ${foo} */
const DOLLARBRACE_RE = /\$\{[a-zA-Z_]+\}/g;

describe('PromptLibrary template rendering', () => {
  let PromptLibrary: any;
  let lib: any;

  before(async () => {
    const mod = await import('@ai-agent-platform/ai');
    PromptLibrary = mod.PromptLibrary;
  });

  // ── daily-message ──────────────────────────────────────

  describe('daily-message', () => {
    const vars = {
      timeOfDay: 'morning',
      serverName: 'TestServer',
      memberCount: '42',
      timeGuidance: 'be warm and energetic',
    };

    before(() => {
      lib = new PromptLibrary();
    });

    it('renders without error', () => {
      const r = lib.render('daily-message', vars);
      assert.ok(r, 'render returned null');
    });

    it('system prompt contains ${timeOfDay} for replaceAll', () => {
      const r = lib.render('daily-message', vars);
      assert.ok(r!.system.includes('${timeOfDay}'), 'system missing ${timeOfDay}');
    });

    it('user prompt has all 4 replaceable placeholders', () => {
      const r = lib.render('daily-message', vars);
      const u = r!.user;
      assert.ok(u.includes('${timeOfDay}'), 'missing ${timeOfDay}');
      assert.ok(u.includes('${serverName}'), 'missing ${serverName}');
      assert.ok(u.includes('${memberCount}'), 'missing ${memberCount}');
      assert.ok(u.includes('${timeGuidance}'), 'missing ${timeGuidance}');
    });

    it('replaceAll removes every placeholder', () => {
      const r = lib.render('daily-message', vars);
      let replaced = r!.system.replaceAll('${timeOfDay}', vars.timeOfDay);
      replaced = r!.user
        .replaceAll('${timeOfDay}', vars.timeOfDay)
        .replaceAll('${serverName}', vars.serverName)
        .replaceAll('${memberCount}', vars.memberCount)
        .replaceAll('${timeGuidance}', vars.timeGuidance);
      assert.ok(!DOLLARBRACE_RE.test(replaced), `remaining placeholders: ${replaced.match(DOLLARBRACE_RE)}`);
    });

    it('has no bare-brace {word} patterns', () => {
      const r = lib.render('daily-message', vars);
      assert.ok(!BAREBRACE_RE.test(r!.system), `system has bare-brace: ${r!.system.match(BAREBRACE_RE)}`);
      assert.ok(!BAREBRACE_RE.test(r!.user), `user has bare-brace: ${r!.user.match(BAREBRACE_RE)}`);
    });
  });

  // ── milestone-message ──────────────────────────────────

  describe('milestone-message', () => {
    const vars = {
      trainerName: 'TestTrainer',
      fanCount: '1.5M',
      tierTitle: 'Gold',
      tierDescription: 'Top tier achievement',
      serverName: 'TestServer',
    };

    before(() => { lib = new PromptLibrary(); });

    it('renders without error', () => {
      assert.ok(lib.render('milestone-message', vars));
    });

    it('user prompt has all 5 replaceable placeholders', () => {
      const u = lib.render('milestone-message', vars)!.user;
      assert.ok(u.includes('${trainerName}'), 'missing ${trainerName}');
      assert.ok(u.includes('${fanCount}'), 'missing ${fanCount}');
      assert.ok(u.includes('${tierTitle}'), 'missing ${tierTitle}');
      assert.ok(u.includes('${tierDescription}'), 'missing ${tierDescription}');
      assert.ok(u.includes('${serverName}'), 'missing ${serverName}');
    });

    it('replaceAll removes every placeholder', () => {
      const u = lib.render('milestone-message', vars)!.user;
      const replaced = u
        .replaceAll('${trainerName}', vars.trainerName)
        .replaceAll('${fanCount}', vars.fanCount)
        .replaceAll('${tierTitle}', vars.tierTitle)
        .replaceAll('${tierDescription}', vars.tierDescription)
        .replaceAll('${serverName}', vars.serverName);
      assert.ok(!DOLLARBRACE_RE.test(replaced), `remaining: ${replaced.match(DOLLARBRACE_RE)}`);
    });

    it('has no bare-brace {word} patterns', () => {
      const u = lib.render('milestone-message', vars)!.user;
      assert.ok(!BAREBRACE_RE.test(u), `bare-brace: ${u.match(BAREBRACE_RE)}`);
    });
  });

  // ── monthly-achievement ────────────────────────────────

  describe('monthly-achievement', () => {
    const vars = {
      trainerName: 'TestTrainer',
      monthlyGain: '12.3M',
      tierTitle: 'Diamond',
      tierDescription: 'Monthly champion',
      serverName: 'TestServer',
    };

    before(() => { lib = new PromptLibrary(); });

    it('renders without error', () => {
      assert.ok(lib.render('monthly-achievement', vars));
    });

    it('user prompt has all 5 replaceable placeholders', () => {
      const u = lib.render('monthly-achievement', vars)!.user;
      assert.ok(u.includes('${trainerName}'));
      assert.ok(u.includes('${monthlyGain}'));
      assert.ok(u.includes('${tierTitle}'));
      assert.ok(u.includes('${tierDescription}'));
      assert.ok(u.includes('${serverName}'));
    });

    it('replaceAll removes every placeholder', () => {
      const u = lib.render('monthly-achievement', vars)!.user;
      const replaced = u
        .replaceAll('${trainerName}', vars.trainerName)
        .replaceAll('${monthlyGain}', vars.monthlyGain)
        .replaceAll('${tierTitle}', vars.tierTitle)
        .replaceAll('${tierDescription}', vars.tierDescription)
        .replaceAll('${serverName}', vars.serverName);
      assert.ok(!DOLLARBRACE_RE.test(replaced));
    });

    it('has no bare-brace {word} patterns', () => {
      const u = lib.render('monthly-achievement', vars)!.user;
      assert.ok(!BAREBRACE_RE.test(u));
    });
  });

  // ── daily-reminder (gap reminder) ───────────────────────

  describe('daily-reminder', () => {
    const vars = {
      trainerData: '1. TrainerA — 10M monthly fans, needs 40M more\n2. TrainerB — 30M monthly fans, needs 20M more',
      serverName: 'TestServer',
    };

    before(() => { lib = new PromptLibrary(); });

    it('renders without error', () => {
      assert.ok(lib.render('daily-reminder', vars));
    });

    it('user prompt has both replaceable placeholders', () => {
      const u = lib.render('daily-reminder', vars)!.user;
      assert.ok(u.includes('${trainerData}'), 'missing ${trainerData}');
      assert.ok(u.includes('${serverName}'), 'missing ${serverName}');
    });

    it('replaceAll removes every placeholder', () => {
      const u = lib.render('daily-reminder', vars)!.user;
      const replaced = u
        .replaceAll('${trainerData}', vars.trainerData)
        .replaceAll('${serverName}', vars.serverName);
      assert.ok(!DOLLARBRACE_RE.test(replaced));
    });

    it('has no bare-brace {word} patterns', () => {
      const u = lib.render('daily-reminder', vars)!.user;
      assert.ok(!BAREBRACE_RE.test(u));
    });

    it('injects real trainer data so AI cannot hallucinate names', () => {
      const u = lib.render('daily-reminder', vars)!.user;
      const replaced = u
        .replaceAll('${trainerData}', vars.trainerData)
        .replaceAll('${serverName}', vars.serverName);
      assert.ok(replaced.includes('TrainerA'), 'trainer data not injected');
      assert.ok(replaced.includes('TrainerB'), 'trainer data not injected');
      assert.ok(replaced.includes('40M'), 'deficit not injected');
      assert.ok(replaced.includes('TestServer'), 'server name not injected');
    });
  });

  // ── race-commentary (vars-direct pattern) ────────────────

  describe('race-commentary', () => {
    const vars = {
      day: '15',
      totalDays: '31',
      racerPositions: '1. SpeChan — 2800m — 45.2M fans',
      dynamicEvents: '⚡ OVERTAKE: SpeChan passed CurrenChan on the backstretch!',
      serverName: 'TestServer',
    };

    before(() => { lib = new PromptLibrary(); });

    it('renders without error', () => {
      assert.ok(lib.render('race-commentary', vars));
    });

    it('injects actual racer data into the prompt', () => {
      const u = lib.render('race-commentary', vars)!.user;
      assert.ok(u.includes('15'), 'day not injected');
      assert.ok(u.includes('31'), 'totalDays not injected');
      assert.ok(u.includes('SpeChan'), 'racer name not injected');
      assert.ok(u.includes('OVERTAKE'), 'events not injected');
    });

    it('has no placeholder patterns at all (vars-direct, no replaceAll needed)', () => {
      const u = lib.render('race-commentary', vars)!.user;
      assert.ok(!DOLLARBRACE_RE.test(u), `found placeholder: ${u.match(DOLLARBRACE_RE)}`);
    });

    it('has no bare-brace {word} patterns', () => {
      const u = lib.render('race-commentary', vars)!.user;
      assert.ok(!BAREBRACE_RE.test(u), `bare-brace: ${u.match(BAREBRACE_RE)}`);
    });

    it('prompt includes the race position details verbatim', () => {
      const u = lib.render('race-commentary', vars)!.user;
      assert.ok(u.includes('2800m'), 'race data missing in prompt');
    });
  });

  // ── new-member-greeting (vars-direct pattern) ────────────

  describe('new-member-greeting', () => {
    const vars = {
      memberName: 'NewPlayer42',
      serverName: 'TestServer',
      memberCount: '100',
    };

    before(() => { lib = new PromptLibrary(); });

    it('renders without error', () => {
      assert.ok(lib.render('new-member-greeting', vars));
    });

    it('injects actual member data into the prompt', () => {
      const u = lib.render('new-member-greeting', vars)!.user;
      assert.ok(u.includes('NewPlayer42'), 'member name not injected');
      assert.ok(u.includes('TestServer'), 'server name not injected');
      assert.ok(u.includes('100'), 'member count not injected');
    });

    it('has no placeholder patterns (vars-direct)', () => {
      const u = lib.render('new-member-greeting', vars)!.user;
      assert.ok(!DOLLARBRACE_RE.test(u));
    });

    it('has no bare-brace {word} patterns', () => {
      const u = lib.render('new-member-greeting', vars)!.user;
      assert.ok(!BAREBRACE_RE.test(u));
    });
  });

  // ── Global: no template leaks bare-brace {word} ──────────

  describe('no template produces {word} without dollar sign', () => {
    before(() => { lib = new PromptLibrary(); });

    const testVars: Record<string, Record<string, string>> = {
      'daily-message':          { timeOfDay: 'morning', serverName: 'S', memberCount: '1', timeGuidance: 'be cool' },
      'milestone-message':      { trainerName: 'T', fanCount: '1M', tierTitle: 'T1', tierDescription: 'desc', serverName: 'S' },
      'monthly-achievement':    { trainerName: 'T', monthlyGain: '1M', tierTitle: 'T1', tierDescription: 'desc', serverName: 'S' },
      'daily-reminder':         { trainerData: 'd', serverName: 'S' },
      'race-commentary':        { day: '1', totalDays: '31', racerPositions: 'p', dynamicEvents: 'e', serverName: 'S' },
      'new-member-greeting':    { memberName: 'N', serverName: 'S', memberCount: '1' },
    };

    for (const [name, vars] of Object.entries(testVars)) {
      it(`${name}`, () => {
        const r = lib.render(name, vars);
        assert.ok(r, `${name} render returned null`);

        // System prompt (if any) must not have bare-brace patterns
        const sysBare = r!.system.match(BAREBRACE_RE);
        assert.ok(!sysBare, `${name} system has bare-brace: ${sysBare}`);

        // User prompt must not have bare-brace patterns
        const userBare = r!.user.match(BAREBRACE_RE);
        assert.ok(!userBare, `${name} user has bare-brace: ${userBare}`);
      });
    }
  });

  // ── Regression: the exact bug that caused Luna/Kaito/Aria ──

  describe('gap reminder regression — hallucinated names', () => {
    before(() => { lib = new PromptLibrary(); });

    it('trainer data block reaches the AI prompt intact', () => {
      const realData = '1. Phil0s — 23.5M monthly fans so far, needs 26.5M more to reach 50M Minimum';
      const r = lib.render('daily-reminder', {
        trainerData: realData,
        serverName: 'Umakraft',
      });

      // Run the same replaceAll chain the service uses
      const final = r!.user
        .replaceAll('${trainerData}', realData)
        .replaceAll('${serverName}', 'Umakraft');

      // The AI must see the real trainer name
      assert.ok(final.includes('Phil0s'), 'AI does not see real trainer name — will hallucinate');

      // The literal placeholder string must be gone
      assert.ok(!final.includes('${trainerData}'), 'placeholder not replaced');
      assert.ok(!final.includes('{trainerData}'), 'bare-brace placeholder leaked');
    });
  });
});
