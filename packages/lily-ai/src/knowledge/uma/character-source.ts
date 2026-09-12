import { CharacterKnowledge } from './types.js';
import { TaxonomyResolver } from '../../services/language/taxonomy-resolver.js';

const mockCharacterData: CharacterKnowledge[] = [
  {
    id: 'CHAR_OGURI_CAP',
    name: 'Oguri Cap',
    rarity: 'SSR',
    surfaceAptitude: ['Turf'],
    distanceAptitude: ['Mile', 'Medium', 'Long'],
    runningStyleAptitude: ['Pace Chaser', 'Late Surger'],
    growthRates: { speed: 10, stamina: 10, power: 20, guts: 0, wisdom: 0 }
  }
];

export class CharacterSource {
  private taxonomy = new TaxonomyResolver();

  public getCharacter(input: string): CharacterKnowledge | null {
    const matches = this.taxonomy.resolve(input);
    const charMatch = matches.find(m => m.type === 'character');
    if (!charMatch) return null;

    return mockCharacterData.find(c => c.name === charMatch.value) || null;
  }
}
