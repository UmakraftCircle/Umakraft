import * as fs from 'fs/promises';
import * as path from 'path';
import { AgentTask, ToolDefinition, createLogger } from '@ai-agent-platform/shared';
import { ExecutionContext, ResolvedFile, RetrievedMemory, MemoryType } from './execution-state.js';
import { ToolRegistry } from './tool-registry.js';
import { MemoryStore } from './memory-store.js';
import { ModelRouter, RoutingDecision } from './model-router.js';
import type { FailureObservation } from './learning.js';

const logger = createLogger('ContextLoader');

export interface MemoryRetrievalQuery {
  task: AgentTask;
  intent?: string;
  toolSlug?: string;
  keywords?: string[];
  types?: MemoryType[];
  limit?: number;
  minScore?: number;
}

export interface IMemoryEngine {
  query(query: MemoryRetrievalQuery): Promise<any[]>;
  createWorkingMemory?(taskId: string, initialData?: Record<string, any>): any;
  getWorkingMemory?(taskId: string): any;
  destroyWorkingMemory?(taskId: string): void;
}

export interface ContextLoaderOptions {
  rootDir?: string;
  toolRegistry?: ToolRegistry;
  memoryStore?: MemoryStore;
  memoryEngine?: IMemoryEngine | any;
  modelRouter?: ModelRouter;
  maxFileSizeBytes?: number;
}

/**
 * ContextLoader is the sole gateway for retrieving resources required by a task.
 * It resolves only directly relevant files, tools, memories, and model configuration
 * without recursive repository loading or business logic execution.
 */
export class ContextLoader {
  private rootDir: string;
  private toolRegistry: ToolRegistry;
  private memoryStore: MemoryStore;
  private memoryEngine?: IMemoryEngine | any;
  private modelRouter?: ModelRouter;
  private maxFileSizeBytes: number;

  constructor(options: ContextLoaderOptions = {}) {
    this.rootDir = path.resolve(options.rootDir ?? process.cwd());
    this.toolRegistry = options.toolRegistry ?? ToolRegistry.getInstance();
    this.memoryStore = options.memoryStore ?? MemoryStore.getInstance();
    this.memoryEngine = options.memoryEngine;
    this.modelRouter = options.modelRouter;
    this.maxFileSizeBytes = options.maxFileSizeBytes ?? 512 * 1024; // 512 KB
  }

  public getMemoryEngine(): IMemoryEngine | any {
    return this.memoryEngine;
  }

  public setMemoryEngine(engine: IMemoryEngine | any): void {
    this.memoryEngine = engine;
  }

  /**
   * Loads minimal context required by the specific task into a fresh ExecutionContext.
   */
  public async loadContext(task: AgentTask): Promise<ExecutionContext> {
    logger.debug(`ContextLoader: Loading minimal resources for task [${task.id}]`);
    const context = new ExecutionContext(task);

    // 1. Resolve required files according to strict priority order
    context.files = await this.resolveFiles(task);

    // 2. Resolve required tool module(s) on demand
    context.tools = this.resolveTools(task);

    // 3. Resolve relevant memories for this task via Memory Engine / Retrieval Pipeline
    context.memories = await this.resolveMemories(task);

    // 4. Initialize working memory for this task (temporary, destroyed after task)
    if (this.memoryEngine && typeof this.memoryEngine.createWorkingMemory === 'function') {
      context.workingMemory = this.memoryEngine.createWorkingMemory(
        task.id,
        task.arguments?.workingMemory
      );
    }

    // 5. Resolve model configuration
    context.model = this.resolveModel(task);

    return context;
  }

  /**
   * Resolves only directly relevant files for the current task.
   * Priority:
   * 1. Current task target
   * 2. Imported dependencies
   * 3. Shared types
   * 4. Configuration (only if referenced)
   * Avoids recursive repository loading.
   */
  public async resolveFiles(task: AgentTask): Promise<Map<string, ResolvedFile>> {
    const files = new Map<string, ResolvedFile>();
    const targetPaths = this.extractTargetFileCandidates(task);

    // ── Priority 1: Current task target ──
    for (const candidate of targetPaths) {
      const resolved = await this.tryReadFile(candidate, 1, 'target');
      if (resolved && !files.has(resolved.relativePath)) {
        files.set(resolved.relativePath, resolved);
      }
    }

    // ── Priority 2: Imported dependencies (direct only, no recursive loading) ──
    const targetFiles = Array.from(files.values());
    for (const target of targetFiles) {
      if (!target.content) continue;
      const directImports = this.extractDirectImports(target.content, target.path);
      for (const importPath of directImports) {
        if (!files.has(importPath)) {
          const resolved = await this.tryReadFile(importPath, 2, 'dependency');
          if (resolved && !files.has(resolved.relativePath)) {
            files.set(resolved.relativePath, resolved);
          }
        }
      }
    }

    // ── Priority 3: Shared types (if referenced) ──
    const referencesTypes = this.checkTypeReferences(task, files);
    if (referencesTypes) {
      const typeCandidates = [
        path.join(this.rootDir, 'packages/shared/src/types.ts'),
        path.join(this.rootDir, 'src/types.ts'),
      ];
      for (const typePath of typeCandidates) {
        if (!files.has(typePath)) {
          const resolved = await this.tryReadFile(typePath, 3, 'types');
          if (resolved && !files.has(resolved.relativePath)) {
            files.set(resolved.relativePath, resolved);
            break; // Load only the primary matching shared types definition
          }
        }
      }
    }

    // ── Priority 4: Configuration (only if explicitly referenced) ──
    const referencedConfigs = this.extractReferencedConfigs(task, files);
    for (const configPath of referencedConfigs) {
      if (!files.has(configPath)) {
        const resolved = await this.tryReadFile(configPath, 4, 'config');
        if (resolved && !files.has(resolved.relativePath)) {
          files.set(resolved.relativePath, resolved);
        }
      }
    }

    return files;
  }

  /**
   * Lazily loads only the tools required by the current task.
   */
  public resolveTools(task: AgentTask): Map<string, ToolDefinition> {
    const tools = new Map<string, ToolDefinition>();
    const requiredSlugs = new Set<string>();

    if (task.toolSlug) {
      requiredSlugs.add(task.toolSlug);
    }

    // Check if task arguments explicitly request specific tools
    if (Array.isArray(task.arguments?.tools)) {
      for (const s of task.arguments.tools) {
        if (typeof s === 'string') requiredSlugs.add(s);
      }
    }

    for (const slug of requiredSlugs) {
      const tool = this.getToolFromRegistry(slug);
      if (tool) {
        tools.set(slug, tool);
      } else {
        // Fallback placeholder tool bound to registry execution
        tools.set(slug, {
          slug,
          name: slug,
          description: `Dynamically bound tool for ${slug}`,
          parameters: {},
          handler: async (args: Record<string, any>) => this.toolRegistry.execute(slug, args),
        });
      }
    }

    return tools;
  }

  /**
   * Resolves relevant memory observations or adaptation rules for this task.
   * Context Loader is the sole consumer of the Memory Engine.
   * Rules:
   * 1. Never inject all memories.
   * 2. Retrieve only task-relevant memories.
   * 3. Rank results before returning.
   */
  public async resolveMemories(
    task: AgentTask
  ): Promise<Array<RetrievedMemory | FailureObservation>> {
    try {
      // ── Option A: Dedicated MemoryEngine retrieval pipeline ──
      if (this.memoryEngine && typeof this.memoryEngine.query === 'function') {
        const keywords = this.extractTaskKeywords(task);
        const query: MemoryRetrievalQuery = {
          task,
          intent: task.name,
          toolSlug: task.toolSlug,
          keywords,
          limit: 5,
        };
        const rankedMemories = await this.memoryEngine.query(query);
        return rankedMemories;
      }

      // ── Option B: Fallback retrieval & ranking over MemoryStore observations ──
      if (typeof this.memoryStore?.loadObservations === 'function') {
        const all = await this.memoryStore.loadObservations();
        if (!all || all.length === 0) return [];

        const scored = all.map((obs) => {
          const relevance = this.calculateObservationRelevance(obs, task);
          const recency = this.calculateObservationRecency(obs);
          const priority = 0.7; // Standard semantic priority
          const exactMatch = Boolean(task.toolSlug && obs.toolSlug === task.toolSlug);
          const exactBonus = exactMatch ? 0.2 : 0.0;
          const score = Number(
            (relevance * 0.4 + recency * 0.2 + priority * 0.2 + exactBonus).toFixed(4)
          );
          return { obs, score, relevance, recency, priority, exactMatch };
        });

        // Filter for task relevance and sort descending by score
        const relevant = scored.filter((s) => s.relevance > 0.1 || s.exactMatch);
        relevant.sort((a, b) => b.score - a.score);

        // Return only top-ranked relevant memories (never inject all)
        return relevant.slice(0, 5).map((s) => {
          const ret: RetrievedMemory = {
            id: s.obs.taskId || `obs-${Date.now()}`,
            type: 'semantic',
            content: s.obs.errorMessage || s.obs.context || JSON.stringify(s.obs),
            score: s.score,
            rankingFactors: {
              relevance: s.relevance,
              recency: s.recency,
              priority: s.priority,
              exactMatch: s.exactMatch,
            },
            taskId: s.obs.taskId,
            taskName: s.obs.taskName,
            toolSlug: s.obs.toolSlug,
            errorMessage: s.obs.errorMessage,
            timestamp: s.obs.timestamp,
            context: s.obs.context,
          };
          return ret;
        });
      }
    } catch (err: any) {
      logger.debug(`Could not resolve memories for task [${task.id}]: ${err.message}`);
    }
    return [];
  }

  private extractTaskKeywords(task: AgentTask): string[] {
    const raw = `${task.name || ''} ${task.toolSlug || ''} ${JSON.stringify(task.arguments || {})}`;
    const words = raw
      .toLowerCase()
      .split(/[\s,._\-:{}"]+/)
      .filter((w) => w.length > 3 && !['true', 'false', 'null', 'undefined'].includes(w));
    return Array.from(new Set(words));
  }

  private calculateObservationRelevance(obs: FailureObservation, task: AgentTask): number {
    const taskNameLower = (task.name || '').toLowerCase();
    const taskArgsStr = JSON.stringify(task.arguments || {}).toLowerCase();
    const obsText = `${obs.taskName || ''} ${obs.errorMessage || ''} ${obs.context || ''}`.toLowerCase();

    let matches = 0;
    const words = `${taskNameLower} ${taskArgsStr}`
      .split(/[\s,._\-:{}"]+/)
      .filter((w) => w.length > 3);

    if (words.length === 0) return 0.2;

    for (const w of words) {
      if (obsText.includes(w)) matches++;
    }
    return Math.min(matches / Math.min(words.length, 5), 1.0);
  }

  private calculateObservationRecency(obs: FailureObservation): number {
    if (!obs.timestamp) return 0.4;
    const ts = new Date(obs.timestamp).getTime();
    if (isNaN(ts)) return 0.4;
    const ageMs = Date.now() - ts;
    const mins = ageMs / (1000 * 60);
    if (mins < 5) return 1.0;
    if (mins < 60) return 0.85;
    if (mins < 1440) return 0.7;
    return 0.4;
  }

  /**
   * Resolves model configuration for this task.
   */
  public resolveModel(task: AgentTask): RoutingDecision | { modelId: string } {
    if (this.modelRouter) {
      try {
        return this.modelRouter.route({
          promptLength: JSON.stringify(task.arguments).length + 200,
          requiresStructuredOutput: true,
          requiresVision: false,
        });
      } catch {
        // Fallback if routing constraints fail
      }
    }
    return { modelId: 'claude-3-5-sonnet' };
  }

  // ── Helper resolution methods ──

  private extractTargetFileCandidates(task: AgentTask): string[] {
    const candidates: string[] = [];
    const args = task.arguments ?? {};

    // Standard file argument names
    for (const key of ['filePath', 'file', 'path', 'target', 'filename', 'sourcePath', 'destinationPath']) {
      if (typeof args[key] === 'string') {
        candidates.push(args[key]);
      }
    }

    // Array of files argument
    if (Array.isArray(args.files)) {
      for (const f of args.files) {
        if (typeof f === 'string') candidates.push(f);
      }
    }

    // Scan task name and string arguments for file patterns (e.g. foo/bar.ts)
    const pattern = /(?:^|[\s"'])([\w\-./\\]+\.(?:ts|tsx|js|jsx|json|sql|md|txt|yaml|yml))(?:[\s"']|$)/g;
    let match: RegExpExecArray | null;

    if (task.name) {
      while ((match = pattern.exec(task.name)) !== null) {
        candidates.push(match[1]);
      }
    }

    for (const val of Object.values(args)) {
      if (typeof val === 'string') {
        while ((match = pattern.exec(val)) !== null) {
          candidates.push(match[1]);
        }
      }
    }

    return candidates;
  }

  private extractDirectImports(content: string, fromFilePath: string): string[] {
    const imports: string[] = [];
    const importRegex = /(?:import|export)\s+(?:.+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    const dir = path.dirname(fromFilePath);

    while ((match = importRegex.exec(content)) !== null) {
      const rel = match[1];
      const resolved = path.resolve(dir, rel);
      imports.push(resolved);
      // Also try with common ts/js extensions if omitted
      if (!path.extname(rel)) {
        imports.push(`${resolved}.ts`);
        imports.push(`${resolved}.js`);
      }
    }

    return imports;
  }

  private checkTypeReferences(task: AgentTask, loadedFiles: Map<string, ResolvedFile>): boolean {
    const serializedArgs = JSON.stringify(task.arguments ?? {});
    if (serializedArgs.includes('type') || task.name.toLowerCase().includes('type')) {
      return true;
    }
    for (const file of loadedFiles.values()) {
      if (file.content && (file.content.includes('@ai-agent-platform/shared') || file.content.includes('/types.js'))) {
        return true;
      }
    }
    return false;
  }

  private extractReferencedConfigs(task: AgentTask, loadedFiles: Map<string, ResolvedFile>): string[] {
    const configs: string[] = [];
    const knownConfigs = ['tsconfig.json', 'package.json', 'drizzle.config.ts', '.env.example'];

    const searchContext = JSON.stringify(task.arguments ?? {}) + ' ' + task.name;
    for (const cfg of knownConfigs) {
      if (searchContext.includes(cfg)) {
        configs.push(path.join(this.rootDir, cfg));
      }
    }

    for (const file of loadedFiles.values()) {
      if (file.content) {
        for (const cfg of knownConfigs) {
          if (file.content.includes(cfg) && !configs.includes(cfg)) {
            configs.push(path.join(this.rootDir, cfg));
          }
        }
      }
    }

    return configs;
  }

  private async tryReadFile(
    targetPath: string,
    priority: 1 | 2 | 3 | 4,
    category: 'target' | 'dependency' | 'types' | 'config'
  ): Promise<ResolvedFile | null> {
    try {
      const absPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(this.rootDir, targetPath);
      const stat = await fs.stat(absPath);
      if (!stat.isFile()) return null;
      if (stat.size > this.maxFileSizeBytes) {
        logger.warn(`Skipping file ${absPath}: size ${stat.size} exceeds limit ${this.maxFileSizeBytes}`);
        return null;
      }

      const content = await fs.readFile(absPath, 'utf-8');
      const relativePath = path.relative(this.rootDir, absPath);

      return {
        path: absPath,
        relativePath,
        content,
        size: stat.size,
        priority,
        category,
      };
    } catch {
      // File does not exist or unreadable, safely ignored
      return null;
    }
  }

  private getToolFromRegistry(slug: string): ToolDefinition | null {
    const registry = this.toolRegistry as any;
    if (registry.tools instanceof Map && registry.tools.has(slug)) {
      return registry.tools.get(slug);
    }
    if (typeof registry.getDeclarativeSchemas === 'function') {
      const schemas = registry.getDeclarativeSchemas([slug]);
      if (schemas && schemas.length > 0) {
        const schema = schemas[0];
        return {
          ...schema,
          handler: async (args: Record<string, any>) => this.toolRegistry.execute(slug, args),
        };
      }
    }
    return null;
  }
}
