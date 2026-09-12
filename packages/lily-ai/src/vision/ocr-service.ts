import { OCRResult } from './vision-types.js';

export class OCRService {
  public async performOCR(imagePath: string): Promise<OCRResult> {
    // Simulated OCR call
    return { text: 'Energy 52, Speed 612', confidence: 0.95 };
  }
}
