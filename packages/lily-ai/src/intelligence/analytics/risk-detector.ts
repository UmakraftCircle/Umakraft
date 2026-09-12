import { RiskAlert } from './analytics-types.js';

export class RiskDetector {
  /**
   * Evaluates historical trainer and club signals to flag risk alerts.
   */
  public detectRisks(missedTargetDays: number, activeDaysInactive: number, parentShortageCount: number): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    if (missedTargetDays >= 14) {
      alerts.push({
        type: 'Fan Deficit Risk',
        probabilityOfFailure: 0.82,
        severity: 'CRITICAL',
        message: `Trainer has missed target pace for ${missedTargetDays} consecutive days.`
      });
    }

    if (activeDaysInactive >= 7) {
      alerts.push({
        type: 'Activity Risk',
        probabilityOfFailure: 0.65,
        severity: 'HIGH',
        message: `Trainer inactive for ${activeDaysInactive} consecutive days. Risk of dropping monthly requirements is high.`
      });
    }

    if (parentShortageCount > 5) {
      alerts.push({
        type: 'Parent Shortage Risk',
        probabilityOfFailure: 0.50,
        severity: 'MEDIUM',
        message: `High demand on specific lineages but only ${parentShortageCount} parents present in PureDB.`
      });
    }

    return alerts;
  }
}
