import { TaxonomyMatch } from './language-analysis.js';
import { 
  BLUE_FACTORS, 
  RED_FACTORS, 
  findBestCharacterMatch 
} from '@ai-agent-platform/umamusume';
import { TAXONOMY_DATA } from '../../knowledge/taxonomy/data.js';

export class TaxonomyResolver {
  public resolve(normalizedMessage: string): TaxonomyMatch[] {
    const matches: TaxonomyMatch[] = [];
    const msg = normalizedMessage.toLowerCase();
    
    // 1. Process Official Taxonomy Data (Running Styles, Distances, Surfaces, Tracks, Skills)
    for (const entity of TAXONOMY_DATA) {
      for (const alias of entity.aliases) {
        // Use word boundaries for aliases to avoid partial matches (e.g., "long" in "belong")
        const regex = new RegExp(`\\b${alias.toLowerCase()}\\b`, 'i');
        if (regex.test(msg)) {
          matches.push({ value: entity.canonical, type: entity.type });
          break; // Move to next entity once matched
        }
      }
    }
    
    // 2. Check against blue factors (speed, stamina, etc.)
    for (const key of Object.keys(BLUE_FACTORS)) {
      if (msg.includes(key.toLowerCase())) {
        matches.push({ value: key, type: 'blue_factor' });
      }
    }

    // 3. Check against red factors (additional ones from legacy RED_FACTORS if not in taxonomy)
    for (const key of Object.keys(RED_FACTORS)) {
      const category = RED_FACTORS[key].category;
      // Skip if already handled by taxonomy
      if (matches.some(m => m.type === category && m.value.toLowerCase() === key.toLowerCase())) continue;
      
      if (msg.includes(key.toLowerCase())) {
        matches.push({ value: key, type: category });
      }
    }

    // 4. Fuzzy match for character names
    const wordsToTest = msg.split(/\s+/);
    for (const word of wordsToTest) {
      if (word.length <= 4) continue; 
      
      const bestMatch = findBestCharacterMatch(word);
      if (bestMatch && bestMatch.score > 85) {
        matches.push({ value: bestMatch.item.canonical, type: 'character' });
      }
    }

    // Deduplicate matches
    return matches.filter((match, index, self) =>
      index === self.findIndex((m) => m.type === match.type && m.value === match.value)
    );
  }
}
