import { IToolService } from './index.js';
import { LanguageAnalysis } from '../language/language-analysis.js';
import { ToolSelection } from './tool-selection.js';
import { ToolRegistry } from './tool-registry.js';
import { ToolResult } from './tool-result.js';

export class LilyToolService implements IToolService {
  constructor(private registry: ToolRegistry = new ToolRegistry()) {}

  /**
   * Receives LanguageAnalysis from the language pipeline and returns 
   * a mapped tool selection without executing it.
   */
  public selectTool(analysis: LanguageAnalysis): ToolSelection {
    const tools = this.registry.getTools();
    
    for (const tool of tools) {
      if (tool.canHandle(analysis)) {
        return { tool: tool.name };
      }
    }
    
    return { tool: null };
  }

  /**
   * Executes a registered tool by name.
   */
  public async executeTool(
    toolName: string, 
    context: { 
      trainerId?: string; 
      trainerName?: string; 
      userId?: string; 
      username?: string; 
      language?: LanguageAnalysis; 
      memory?: any 
    }
  ): Promise<ToolResult> {
    const tool = this.registry.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found in registry.`
      };
    }
    if (tool.execute) {
      return await tool.execute(context);
    }
    return {
      success: true,
      data: { tool: toolName, executed: true }
    };
  }

  public getRegistry(): ToolRegistry {
    return this.registry;
  }
}
