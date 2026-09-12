import { TrackKnowledge } from './types.js';
import { TaxonomyResolver } from '../../services/language/taxonomy-resolver.js';

export class TrackSource {
  private taxonomy = new TaxonomyResolver();

  public getTrack(input: string): TrackKnowledge | null {
    const matches = this.taxonomy.resolve(input);
    const trackMatch = matches.find(m => m.type === 'track');
    if (!trackMatch) return null;
    return null; // Placeholder for now
  }
}
