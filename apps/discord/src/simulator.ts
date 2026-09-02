import * as readline from 'readline';
import { toolRegistry, Planner, TaskManager } from '@ai-agent-platform/core';
import { MockAIService } from '@ai-agent-platform/ai';
import { logger } from './bootstrap.js';

async function runAgentPipeline(prompt: string) {
  const { Planner, TaskManager } = await import('@ai-agent-platform/core');
  const { MockAIService } = await import('@ai-agent-platform/ai');

  const ai = new MockAIService('claude-3-5-sonnet');
  const planner = new Planner(ai, toolRegistry);
  const taskManager = new TaskManager(toolRegistry);

  console.log(`\n⏳ Planning for: "${prompt}"...`);
  const plan = await planner.plan(prompt);

  console.log(`📋 Plan generated: ${plan.tasks.size} steps`);
  for (const task of plan.tasks.values()) {
    const deps = task.dependencies.length > 0 ? ` (after ${task.dependencies.join(', ')})` : '';
    console.log(`  [${task.id}] ${task.name} via ${task.toolSlug}${deps}`);
  }

  console.log('🚀 Executing...');
  const result = await taskManager.executePlan(plan);

  let ok = 0, fail = 0;
  for (const task of result.tasks.values()) {
    if (task.status === 'completed') ok++;
    else fail++;
    console.log(`  [${task.id}] ${task.status}: ${task.result ? JSON.stringify(task.result).slice(0, 80) : task.error}`);
  }

  console.log(`\n✅ ${ok}/${result.tasks.size} tasks succeeded.\n`);
}


export function startSimulator() {
  logger.warn('No DISCORD_BOT_TOKEN detected!');
  logger.info('Booting in interactive CLI SIMULATOR mode.');
  logger.info('');
  logger.info('Available commands (simulated):');
  logger.info('  /sync                          — refresh cache');
  logger.info('  /search parent [character]     — generate Pure-DB parent search link');
  logger.info('  /ask question <question>       — submit a question');
  logger.info('  /ask answer <question_id>      — retrieve answer');
  logger.info('  /ask correction <id> <answer>  — admin correction (force remove & replace answer)');
  logger.info('  /fans gain [daily|weekly|monthly]  — fan gain');
  logger.info('  /fans leaderboard [10|15|20|30] [daily|weekly|monthly]');
  logger.info('  /link add <user> <trainer-id>  — link user');
  logger.info('  /link remove <user>            — unlink user');
  logger.info('  /link list                     — show links');
  logger.info('  !agent <prompt>                — run full agent pipeline');
  logger.info('  exit                           — quit');
  logger.info('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('\x1b[36m[Discord #general-chat]>\x1b[0m ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit') {
        rl.close();
        logger.info('Simulator stopped.');
        process.exit(0);
      }

      if (trimmed.startsWith('!agent ')) {
        await runAgentPipeline(trimmed.replace('!agent ', ''));
      } else if (trimmed.startsWith('/search')) {
        const query = trimmed.replace(/^\/search\s*(parent)?\s*/i, '').trim();
        const { buildPureDbSearchUrl, searchCharacters } = await import('@ai-agent-platform/umamusume');
        const matched = query ? searchCharacters(query, 1)[0] : null;
        const url = buildPureDbSearchUrl({
          gameServerCode: 'global',
          partnerCardIds: matched ? [Number(matched.value)] : [],
          supportCardId: 0,
          supportCardLimitBreak: 4,
          excludeCardIds: [],
          excludeCardSearchType: 0,
          blueFactors: [],
          redFactors: [],
          greenFactors: [],
          commonSkillFactors: [],
          raceFactors: [],
          scenarioFactors: [],
          otherFactors: [],
          whiteFactorCountConditions: [],
          winCount: 0,
          g1WinCount: 0,
          searchCount: 100,
          excludeFullFollowerUser: true,
          excludeArchivedChara: true,
        });
        console.log('\x1b[32m[Pure-DB Search]\x1b[0m');
        if (matched) {
          console.log(`  Uma Target: ${matched.name} (ID: ${matched.value})`);
        }
        console.log(`  URL: ${url}\n`);
      } else if (trimmed.startsWith('/ask')) {
        const { askQuestionStore, askResponseCache } = await import('@ai-agent-platform/integrations');
        if (trimmed.startsWith('/ask question ')) {
          const qText = trimmed.replace(/^\/ask\s+question\s+/i, '').trim();
          const rec = await askQuestionStore.create({
            question: qText,
            userId: 'sim-user-123',
            channelId: 'sim-channel-123',
          });
          console.log('\x1b[32m[Ask Question Created]\x1b[0m');
          console.log(`  Question ID: ${rec.id}`);
          console.log(`  Question: ${rec.question}`);
          console.log(`  Status: ${rec.status}`);
          console.log(`  Use: /ask answer ${rec.id} to retrieve or /ask correction ${rec.id} <answer> to correct.\n`);
        } else if (trimmed.startsWith('/ask answer ')) {
          const qId = trimmed.replace(/^\/ask\s+answer\s+/i, '').trim();
          const rec = await askQuestionStore.get(qId);
          if (!rec) {
            console.log(`\x1b[31m[Ask Error]\x1b[0m Question not found for ID: ${qId}\n`);
          } else {
            console.log('\x1b[32m[Ask Answer Record]\x1b[0m');
            console.log(`  ID: ${rec.id}`);
            console.log(`  Question: ${rec.question}`);
            console.log(`  Status: ${rec.status}`);
            console.log(`  Usage: ${rec.usageCount}/${rec.maxUses}`);
            console.log(`  Answer: ${rec.answer ?? '(None - pending generation)'}\n`);
          }
        } else if (trimmed.startsWith('/ask correction ')) {
          const parts = trimmed.replace(/^\/ask\s+correction\s+/i, '').trim().split(/\s+(.+)/);
          const qId = parts[0];
          const newAns = parts[1];
          if (!qId || !newAns) {
            console.log('\x1b[31m[Ask Error]\x1b[0m Usage: /ask correction <question_id> <new_accurate_answer>\n');
          } else {
            const result = await askQuestionStore.correctAnswer(qId, newAns, true);
            if (!result.record) {
              console.log(`\x1b[31m[Ask Error]\x1b[0m Question not found for ID: ${qId}\n`);
            } else {
              await askResponseCache.set(result.record.question.toLowerCase().trim(), newAns);
              console.log('\x1b[32m[Ask Correction Applied]\x1b[0m');
              console.log(`  Question ID: ${result.record.id}`);
              console.log(`  Question: ${result.record.question}`);
              console.log(`  Previous Answer: ${result.previousAnswer ?? '(None)'}`);
              console.log(`  New Accurate Answer: ${result.record.answer}`);
              console.log(`  Usage: ${result.record.usageCount}/${result.record.maxUses} (Reset to 0 for retrieval)\n`);
            }
          }
        } else {
          console.log('\x1b[33m[Simulator]\x1b[0m Usage: /ask question <text> | /ask answer <qid> | /ask correction <qid> <new_answer>\n');
        }
      } else if (trimmed.startsWith('/')) {
        console.log('\x1b[33m[Simulator]\x1b[0m Slash commands require a real Discord connection.');
        console.log('  Set DISCORD_BOT_TOKEN + DISCORD_CLIENT_ID to enable full Gateway mode.\n');
      } else if (trimmed !== '') {
        console.log('\x1b[90m[System] Message sent (use !agent or /command)\x1b[0m\n');
      }

      promptUser();
    });
  };

  promptUser();
}
