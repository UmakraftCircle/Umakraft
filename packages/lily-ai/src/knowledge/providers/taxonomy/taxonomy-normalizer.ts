export class TaxonomyNormalizer {
  /**
   * Normalizes a search or name term for index matching.
   * Lowercases, trims whitespace, standardizes punctuation.
   */
  public static normalize(text: string): string {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, ' ')
      .replace(/[^\w\s\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af○!]/g, '')
      .trim();
  }

  /**
   * Normalizes category identifiers to lowercase stripped format (e.g. "Running Style" -> "runningstyle").
   */
  public static normalizeCategory(category: string): string {
    if (!category) return '';
    return category
      .trim()
      .toLowerCase()
      .replace(/[\s\-_]+/g, '');
  }

  /**
   * Canonicalizes capitalization if needed.
   */
  public static cleanTerm(term: string): string {
    return term ? term.trim() : '';
  }
}
