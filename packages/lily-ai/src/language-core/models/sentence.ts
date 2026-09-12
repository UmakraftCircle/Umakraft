import { Token } from './token.js';

export interface Sentence {
  text: string;
  tokens: Token[];
  startIndex: number;
  endIndex: number;
}
