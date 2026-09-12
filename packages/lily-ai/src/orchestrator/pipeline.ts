import { LilyExecutionContext } from './execution-context.js';
import { ExecutionResult } from './execution-result.js';

export type PipelineStage = (context: LilyExecutionContext) => Promise<void>;

export class LilyPipeline {
  private stages: PipelineStage[] = [];

  public addStage(stage: PipelineStage): void {
    this.stages.push(stage);
  }

  public async execute(context: LilyExecutionContext): Promise<ExecutionResult> {
    try {
      for (const stage of this.stages) {
        await stage(context);
      }

      if (!context.response) {
        throw new Error("Pipeline completed but no response was generated.");
      }

      return {
        success: true,
        response: context.response
      };
    } catch (error: any) {
      return {
        success: false,
        response: "I encountered an error processing your request. Please try again later.",
        error: error.message || String(error)
      };
    }
  }
}
