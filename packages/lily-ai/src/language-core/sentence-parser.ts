import { Sentence } from './models/sentence.js';
import { Tokenizer } from './tokenizer.js';

export class SentenceParser {
  private tokenizer = new Tokenizer();

  public parse(text: string): Sentence[] {
    const sentences: Sentence[] = [];
    // Split by sentence boundary punctuation (., !, ?) while keeping the boundaries
    const regex = /([^.!?\n]+[.!?\n]*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const sentenceText = match[0].trim();
      if (sentenceText) {
        const start = match.index;
        const end = start + match[0].length;
        sentences.push({
          text: sentenceText,
          tokens: this.tokenizer.tokenize(sentenceText),
          startIndex: start,
          endIndex: end
        });
      }
    }

    return sentences;
  }
}
