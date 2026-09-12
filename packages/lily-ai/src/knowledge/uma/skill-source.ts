import { SkillKnowledge } from './types.js';
import { TaxonomyResolver } from '../../services/language/taxonomy-resolver.js';

const mockSkillData: SkillKnowledge[] = [
  {
    id: 'SKILL_CONCENTRATION',
    name: 'Concentration',
    description: 'Reduces delay when starting a race.',
    rarity: 'SSR',
    category: 'Start Skill'
  }
];

export class SkillSource {
  private taxonomy = new TaxonomyResolver();

  public getSkill(input: string): SkillKnowledge | null {
    const matches = this.taxonomy.resolve(input);
    const skillMatch = matches.find(m => m.type === 'skill');
    if (!skillMatch) return null;

    return mockSkillData.find(s => s.name === skillMatch.value) || null;
  }
}
