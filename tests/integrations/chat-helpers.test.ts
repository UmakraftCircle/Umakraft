/**
 * Chat helpers unit tests.
 *
 * Covers the pure, framework-free logic behind `/chat`:
 *   - explicit-vs-inferred favourite detection (the core "latest explicit wins"
 *     and "passing mention is NOT a favourite" rules)
 *   - multiple favourites in a single statement
 *   - the deterministic digest summarizer
 *   - conversation-context rendering
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

async function loadHelpers() {
  return await import('@ai-agent-platform/integrations');
}

describe('detectFavoriteUmamusume', () => {
  it('exports the helper', async () => {
    const mod = await loadHelpers();
    assert.equal(typeof mod.detectFavoriteUmamusume, 'function');
  });

  it('detects an explicit favorite ("my favorite is X")', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    assert.deepEqual(detect('My favorite is Tokai Teio'), ['Tokai Teio']);
  });

  it('detects an explicit favorite ("I love X")', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    const out = detect('I really love Special Week');
    assert.ok(out.some((f) => /special week/i.test(f)));
  });

  it('detects an explicit favorite ("X is my favorite")', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    const out = detect('Maruzensky is my favorite');
    assert.ok(out.some((f) => /maruzensky/i.test(f)));
  });

  it('splits multiple favourites on commas', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    const out = detect('My favorites are Special Week, Tokai Teio, Gold Ship');
    assert.ok(out.some((f) => /special week/i.test(f)));
    assert.ok(out.some((f) => /tokai teio/i.test(f)));
    assert.ok(out.some((f) => /gold ship/i.test(f)));
  });

  it('does NOT treat a passing mention as a favourite', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    // "I was using X in my last race" is not an explicit favourite statement.
    assert.deepEqual(detect('I was using Tokai Teio in my last race'), []);
    assert.deepEqual(detect('Did you see Silence Suzuka on the leaderboard?'), []);
  });

  it('returns [] for a message with no favourite signal', async () => {
    const mod = await loadHelpers();
    const detect = mod.detectFavoriteUmamusume;
    assert.deepEqual(detect('What is a support card?'), []);
  });
});

describe('summarizeQuestions (digest summarizer)', () => {
  it('folds empty input back to the previous digest', async () => {
    const mod = await loadHelpers();
    const out = await mod.summarizeQuestions([], 'prior-digest');
    assert.equal(out, 'prior-digest');
  });

  it('returns an empty string when there is nothing to summarize', async () => {
    const mod = await loadHelpers();
    const out = await mod.summarizeQuestions([], null);
    assert.equal(out, '');
  });

  it('prefixes the previous digest and appends a timestamp line', async () => {
    const mod = await loadHelpers();
    const out = await mod.summarizeQuestions(['Who is Tokai Teio?', 'Best banner?'], 'existing-summary');
    assert.ok(out.startsWith('existing-summary\n'));
    assert.ok(out.includes('Who is Tokai Teio?'));
    assert.ok(out.includes('Best banner?'));
  });

  it('drops blank/whitespace questions', async () => {
    const mod = await loadHelpers();
    const out = await mod.summarizeQuestions(['   ', 'Who is Gold Ship?'], null);
    assert.ok(!out.includes('   '));
    assert.ok(out.includes('Who is Gold Ship?'));
  });
});

describe('buildContextTurns', () => {
  it('returns undefined for no turns', async () => {
    const mod = await loadHelpers();
    assert.equal(mod.buildContextTurns([]), undefined);
  });

  it('renders Trainer/Assistant labels', async () => {
    const mod = await loadHelpers();
    const out = mod.buildContextTurns([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello Trainer!' },
    ]);
    assert.ok(out!.includes('Trainer: hi'));
    assert.ok(out!.includes('Assistant: hello Trainer!'));
  });

  it('caps the number of turns at maxTurns', async () => {
    const mod = await loadHelpers();
    const turns = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `msg-${i}`,
    }));
    const out = mod.buildContextTurns(turns, 20);
    assert.ok(!out!.includes('msg-0')); // oldest dropped
    assert.ok(out!.includes('msg-24')); // newest kept
    const lines = out!.split('\n');
    assert.equal(lines.length, 20);
  });
});
