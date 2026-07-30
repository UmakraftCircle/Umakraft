import { createLogger, loadConfig, PLATFORM_NAME } from '@ai-agent-platform/shared';
import { MockAIService } from '@ai-agent-platform/ai';
import { toolRegistry, Planner, TaskManager, ModelRouter } from '@ai-agent-platform/core';
// Import all platform tools to populate the core registry
import { allTools, webTools, notificationTools } from '@ai-agent-platform/tools';
import { allIntegrations } from '@ai-agent-platform/integrations';
import { allDomainTools } from '@ai-agent-platform/fan-tracker';
const logger = createLogger('CLI-Bootstrap');
async function main() {
    logger.info(`==================================================`);
    logger.info(`Starting ${PLATFORM_NAME} Engine...`);
    logger.info(`==================================================`);
    const config = loadConfig();
    logger.info(`Loaded Environment configuration: Env = "${config.env}"`);
    // Step 1: Register all available tools into the Core Tool Registry
    logger.info('Registering platform, integration, and domain tools...');
    for (const tool of allTools) {
        toolRegistry.register(tool);
    }
    for (const tool of webTools) {
        toolRegistry.register(tool);
    }
    for (const tool of notificationTools) {
        toolRegistry.register(tool);
    }
    for (const integration of allIntegrations) {
        toolRegistry.register(integration);
    }
    for (const domainTool of allDomainTools) {
        toolRegistry.register(domainTool);
    }
    const totalTools = toolRegistry.getDeclarativeSchemas().length;
    logger.info(`Total registered tools: ${totalTools}`);
    // Step 2: Show available AI models via ModelRouter
    const router = new ModelRouter();
    const models = router.getAvailableModels();
    logger.info(`Available AI models: ${models.map(m => m.name).join(', ')}`);
    // Step 3: Initialize AI reasoning service
    const aiService = new MockAIService('claude-3-5-sonnet');
    logger.info(`Initialized AI Reasoning Bridge: ${aiService.getCurrentModel()}`);
    // Step 4: Initialize Planner and TaskManager
    const planner = new Planner(aiService, toolRegistry);
    const taskManager = new TaskManager(toolRegistry);
    // Step 5: Run a full Planning and Execution Loop
    const prompt = 'Please update and analyze my Umamusume trainer stats for ID trainer-99, compose a report file, and ping Discord.';
    logger.info(`\n[User Intent] -> "${prompt}"`);
    try {
        // 5.1 Planning Stage
        logger.info('\n--- [STAGE 1] INTAKE & PLANNING ---');
        const plan = await planner.plan(prompt);
        logger.info(`Plan generated successfully! Plan ID: ${plan.id}`);
        logger.info(`Tasks in dependency chain:`);
        for (const task of plan.tasks.values()) {
            logger.info(`  - Task [${task.id}]: "${task.name}" (depends on: [${task.dependencies.join(', ')}])`);
        }
        // 5.2 Execution Stage
        logger.info('\n--- [STAGE 2] PARALLEL EXECUTION LOOP ---');
        const executedPlan = await taskManager.executePlan(plan);
        logger.info('\n--- [STAGE 3] WORKFLOW SUMMARY ---');
        logger.info(`Plan execution ended.`);
        logger.info(`Execution Stats:`);
        let completedCount = 0;
        for (const task of executedPlan.tasks.values()) {
            logger.info(`  Task [${task.id}] - Status: ${task.status.toUpperCase()} (Retries: ${task.retryCount})`);
            if (task.status === 'completed') {
                completedCount++;
                logger.info(`    -> Result: ` + JSON.stringify(task.result, null, 2));
            }
            else {
                logger.error(`    -> Error: ${task.error}`);
            }
        }
        logger.info(`\nFinal Verdict: ${completedCount}/${executedPlan.tasks.size} tasks completed successfully.`);
        logger.info(`==================================================`);
    }
    catch (error) {
        logger.error('Fatal platform crash inside execution pipeline!', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=index.js.map