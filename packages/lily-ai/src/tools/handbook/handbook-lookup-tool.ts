import { LilyTool, ToolExecutionContext } from '../../services/tools/tool-selection.js';
import { LanguageAnalysis } from '../../services/language/language-analysis.js';
import { ToolResult } from '../../services/tools/tool-result.js';
import { HandbookKnowledgeSource } from '../../knowledge/handbook/handbook-source.js';

export class HandbookLookupTool implements LilyTool {
  public name = 'HandbookLookupTool';
  private source = new HandbookKnowledgeSource();

  public canHandle(analysis: LanguageAnalysis): boolean {
    const domains = [
      'club_rules',
      'membership',
      'fan_requirements',
      'activity_rules',
      'linking',
      'club_procedures',
      'faq'
    ];
    return domains.includes(analysis.intent) || analysis.intent === 'knowledge_query';
  }

  public async execute(context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const query = context.language?.normalizedMessage || '';
      const results = await this.source.query(context.language!);

      if (results.length > 0) {
        return {
          success: true,
          data: {
            source: 'handbook',
            results: results
          }
        };
      }

      return {
        success: true,
        data: {
          source: 'handbook',
          results: [],
          message: 'I searched the club handbook but couldn\'t find a specific section matching your query.'
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to lookup handbook information'
      };
    }
  }
}
