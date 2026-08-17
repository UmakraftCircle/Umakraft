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
