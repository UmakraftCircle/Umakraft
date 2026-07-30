import { Client, GatewayIntentBits, Message } from 'discord.js';
import { createLogger, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { toolRegistry, Planner, TaskManager } from '@ai-agent-platform/core';
import { MockAIService } from '@ai-agent-platform/ai';
import * as readline from 'readline';

// Import all platform tools to populate the core registry
import { allTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools } from '@ai-agent-platform/fan-tracker';

const logger = createLogger('Discord-Bot');

// Automatically register all tools in the core registry
for (const tool of allTools) {
  toolRegistry.register(tool);
}
for (const integration of allIntegrations) {
  toolRegistry.register(integration);
}
for (const domainTool of allDomainTools) {
  toolRegistry.register(domainTool);
}

// Initialize core services
const aiService = new MockAIService('claude-3-5-sonnet');
const planner = new Planner(aiService, toolRegistry);
const taskManager = new TaskManager(toolRegistry);

/**
 * Handles incoming chat intents and executes the agent loop.
 * Shared between real Discord integration and CLI Simulator.
 */
async function handleAgentCommand(content: string, replySender: (msg: string) => Promise<any>) {
  if (!content.startsWith('!agent ')) return;

  const userPrompt = content.replace('!agent ', '').trim();
  await replySender(`⏳ **[Intake]** Received request: "${userPrompt}". Analyzing and planning operations...`);

  try {
    // Stage 1: Planning
    logger.info(`Generating Execution Plan for prompt: "${userPrompt}"`);
    const plan = await planner.plan(userPrompt);

    let planMessage = `📋 **[Plan Generated]** (Plan ID: \`${plan.id}\`)\n` +
                      `The agent has generated a secure dependency-validated DAG with **${plan.tasks.size} steps**:\n`;
    
    for (const task of plan.tasks.values()) {
      const deps = task.dependencies.length > 0 ? ` (depends on: \`${task.dependencies.join(', ')}\`)` : '';
      planMessage += `  - Step \`[${task.id}]\`: **${task.name}** using tool \`${task.toolSlug}\`${deps}\n`;
    }
    
    planMessage += `\n🚀 Initiating parallel execution loop...`;
    await replySender(planMessage);

    // Stage 2: Parallel Execution
    logger.info(`Starting execution loop for plan: ${plan.id}`);
    const executedPlan = await taskManager.executePlan(plan);

    // Stage 3: Summary Compilation
    let summaryMessage = `✅ **[Execution Complete]**\nAll steps executed successfully. Summary stats:\n`;
    let completedCount = 0;
    
    for (const task of executedPlan.tasks.values()) {
      if (task.status === 'completed') {
        completedCount++;
        summaryMessage += `  - Step \`[${task.id}]\` **${task.name}**: completed. Result: \`${JSON.stringify(task.result)}\`\n`;
      } else {
        summaryMessage += `  - Step \`[${task.id}]\` **${task.name}**: FAILED. Error: \`${task.error}\`\n`;
      }
    }

    summaryMessage += `\nFinal Status: **${completedCount}/${executedPlan.tasks.size} tasks succeeded**. Workflow ended.`;
    await replySender(summaryMessage);

  } catch (error: any) {
    logger.error('Error executing Discord agent command', error);
    await replySender(`❌ **[Platform Error]** A critical error occurred during execution: ${error?.message || error}`);
  }
}

/**
 * Boots the Discord Bot Client in Real Gateway Mode or Interactive Developer Simulator Mode.
 */
async function startBot() {
  const token = process.env['DISCORD_BOT_TOKEN'];

  logger.info(`==================================================`);
  logger.info(`Starting ${PLATFORM_NAME} Discord Service...`);
  logger.info(`==================================================`);

  if (token && token.trim() !== '') {
    // --- REAL DISCORD GATEWAY MODE ---
    logger.info(`Token discovered. Starting connection in Gateway Mode...`);
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    client.on('ready', () => {
      logger.info(`Logged in as real Discord bot user: ${client.user?.tag}!`);
      logger.info(`Listening to channel messages starting with "!agent"`);
    });

    client.on('messageCreate', async (message: Message) => {
      if (message.author.bot) return;
      await handleAgentCommand(message.content, async (msg) => {
        return message.reply(msg);
      });
    });

    try {
      await client.login(token);
    } catch (err: any) {
      logger.error(`Failed to log in to Discord gateway with provided token! Error:`, err);
      process.exit(1);
    }

  } else {
    // --- INTERACTIVE DEVELOPER SIMULATOR MODE ---
    logger.warn(`No DISCORD_BOT_TOKEN detected in environment!`);
    logger.info(`Booting up in interactive DEVELOPER SIMULATOR mode.`);
    logger.info(`This simulates a discord channel right inside your terminal.`);
    logger.info(`Try typing command: "!agent update my stats"`);
    logger.info(`Type "exit" to quit the simulator.\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const promptUser = () => {
      rl.question('\x1b[36m[Discord Channel #general-chat] User:\x1b[0m ', async (userInput) => {
        if (userInput.trim().toLowerCase() === 'exit') {
          rl.close();
          logger.info('Exiting simulator.');
          process.exit(0);
        }

        if (userInput.startsWith('!agent ')) {
          await handleAgentCommand(userInput, async (replyContent) => {
            console.log(`\n\x1b[35m[Discord Bot @${PLATFORM_NAME}]:\x1b[0m\n${replyContent}\n`);
          });
        } else if (userInput.trim() !== '') {
          console.log(`\n[System] Message sent to channel (but bot ignored since it didn't start with "!agent ").\n`);
        }

        promptUser();
      });
    };

    promptUser();
  }
}

startBot();
