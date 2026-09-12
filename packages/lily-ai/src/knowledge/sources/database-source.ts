import { KnowledgeSource } from '../knowledge-source.js';
import { KnowledgeQuery } from '../knowledge-context.js';
import { KnowledgeResult } from '../knowledge-result.js';
import { CharacterKnowledge, SkillKnowledge } from '../uma/types.js';

// Official in-memory Database records
const DATABASE_CHARACTERS: CharacterKnowledge[] = [
  {
    id: 'CHAR_OGURI_CAP',
    name: 'Oguri Cap',
    rarity: 'SSR',
    surfaceAptitude: ['Turf', 'Dirt'],
    distanceAptitude: ['Mile', 'Medium', 'Long'],
    runningStyleAptitude: ['Pace Chaser', 'Late Surger'],
    growthRates: { speed: 10, stamina: 10, power: 20, guts: 0, wisdom: 0 }
  },
  {
    id: 'CHAR_MEJIRO_MCQUEEN',
    name: 'Mejiro McQueen',
    rarity: 'SSR',
    surfaceAptitude: ['Turf'],
    distanceAptitude: ['Medium', 'Long'],
    runningStyleAptitude: ['Front Runner', 'Pace Chaser'],
    growthRates: { speed: 0, stamina: 20, power: 0, guts: 0, wisdom: 10 }
  },
  {
    id: 'CHAR_TOKAI_TEIO',
    name: 'Tokai Teio',
    rarity: 'SSR',
    surfaceAptitude: ['Turf'],
    distanceAptitude: ['Medium', 'Long'],
    runningStyleAptitude: ['Pace Chaser', 'Late Surger'],
    growthRates: { speed: 20, stamina: 10, power: 0, guts: 0, wisdom: 0 }
  }
];

const DATABASE_SKILLS: SkillKnowledge[] = [
  {
    id: 'SKILL_CONCENTRATION',
    name: 'Concentration',
    description: 'Reduces delay when starting a race and improves start reaction time.',
    rarity: 'SSR',
    category: 'Start Skill'
  },
  {
    id: 'SKILL_PROFESSOR',
    name: 'Professor of Curvature',
    description: 'Increases speed on corners during the middle leg.',
    rarity: 'SSR',
    category: 'Speed Skill'
  }
];

export class DatabaseKnowledgeSource implements KnowledgeSource {
  public id = 'database';
  public name = 'Official Database';
  public type = 'database';
  public priority = 85; // Authority: 85

  public async query(query: KnowledgeQuery): Promise<KnowledgeResult[]> {
    const rawTerm = query.term.trim().toLowerCase();
    if (!rawTerm) return [];

    const results: KnowledgeResult[] = [];

    // Query characters
    for (const char of DATABASE_CHARACTERS) {
      if (char.name.toLowerCase().includes(rawTerm) || rawTerm.includes(char.name.toLowerCase())) {
        results.push({
          source: 'database',
          authority: this.priority,
          content: char,
          confidence: 0.95,
          metadata: {
            id: char.id,
            name: char.name,
            type: 'character',
            category: 'character',
            domain: 'Umamusume'
          }
        });
      }
    }

    // Query skills
    for (const skill of DATABASE_SKILLS) {
      if (skill.name.toLowerCase().includes(rawTerm) || rawTerm.includes(skill.name.toLowerCase())) {
        results.push({
          source: 'database',
          authority: this.priority,
          content: skill,
          confidence: 0.95,
          metadata: {
            id: skill.id,
            name: skill.name,
            type: 'skill',
            category: 'skill',
            domain: 'Umamusume'
          }
        });
      }
    }

    return results;
  }
}
