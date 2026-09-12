export class FuzzyMatcher {
  /**
   * Calculates the Levenshtein distance between two strings
   */
  public getDistance(a: string, b: string): number {
    const matrix = [];

    // Increment along the first column of each row
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    // Increment each column in the first row
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Returns candidates sorted by distance, with their similarity score.
   */
  public match(input: string, candidates: string[]): { candidate: string; distance: number; similarity: number }[] {
    const normalizedInput = input.toLowerCase().trim();
    return candidates
      .map(candidate => {
        const normalizedCandidate = candidate.toLowerCase().trim();
        const distance = this.getDistance(normalizedInput, normalizedCandidate);
        const maxLength = Math.max(normalizedInput.length, normalizedCandidate.length);
        const similarity = maxLength === 0 ? 1 : 1 - distance / maxLength;
        return { candidate, distance, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }
}
