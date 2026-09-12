import { OCRService } from './ocr-service.js';
import { ScreenshotParser } from './screenshot-parser.js';
import { TrainingDetector } from './detectors/training-detector.js';

export class VisionService {
  private ocr = new OCRService();
  private parser = new ScreenshotParser();
  private trainingDetector = new TrainingDetector();

  public async analyzeTrainingScreenshot(imagePath: string) {
    const ocrResult = await this.ocr.performOCR(imagePath);
    const structuredData = this.parser.parseToStructure(ocrResult);
    return this.trainingDetector.detect(structuredData);
  }
}
