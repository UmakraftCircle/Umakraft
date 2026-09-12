import { OutboundPayload } from './federation-types.js';
import { FederationPolicy } from './federation-policy.js';

export class FederationServer {
  private policy = new FederationPolicy();

  /**
   * Simulates receiving federated insights from other nodes.
   */
  public receivePayload(payload: OutboundPayload): { accepted: boolean; reason?: string } {
    if (!this.policy.validatePolicy(payload)) {
      return { accepted: false, reason: 'Rejected: Violates privacy policies. Personal identifiers detected.' };
    }
    return { accepted: true };
  }
}
