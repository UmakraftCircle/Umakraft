import { Token } from './models/token.js';

export class Tokenizer {
  public tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    // Split by whitespace and common punctuation, while keeping them separated
    const regex = /([a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+|[\p{P}\p{S}])/gu;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      tokens.push({
        text: matchText.toLowerCase(),
        originalText: matchText,
        startIndex: match.index,
        endIndex: match.index + matchText.length
      });
    }

    return tokens;
  }
}
