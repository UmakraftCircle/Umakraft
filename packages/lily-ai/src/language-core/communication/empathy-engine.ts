export interface EmpathyResult {
  tone: string;
  pacing: string;
  celebrationAllowed: boolean;
}

export class EmpathyEngine {
  public adjust(emotion: string): EmpathyResult {
    switch (emotion) {
      case 'Frustrated':
        return {
          tone: 'Supportive',
          pacing: 'Empathetic',
          celebrationAllowed: false
        };
      case 'Confused':
        return {
          tone: 'Patient',
          pacing: 'Step-by-step',
          celebrationAllowed: false
        };
      case 'Excited':
      case 'Happy':
        return {
          tone: 'Enthusiastic',
          pacing: 'Hype',
          celebrationAllowed: true
        };
      case 'Concerned':
      case 'Urgent':
        return {
          tone: 'Reassuring',
          pacing: 'Direct',
          celebrationAllowed: false
        };
      case 'Curious':
        return {
          tone: 'Informative',
          pacing: 'Exploratory',
          celebrationAllowed: true
        };
      default:
        return {
          tone: 'Friendly',
          pacing: 'Standard',
          celebrationAllowed: true
        };
    }
  }
}
