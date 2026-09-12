export class FederationPolicy {
  /**
   * Evaluates whether a federation node's share settings are within policy bounds.
   */
  public validatePolicy(payload: any): boolean {
    // Policy check: If there is any raw user credentials, reject
    if (
      payload.userId || 
      payload.trainerId || 
      payload.discordId || 
      payload.username ||
      payload.email
    ) {
      return false;
    }
    return true;
  }
}
