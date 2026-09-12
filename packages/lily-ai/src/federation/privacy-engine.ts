export class PrivacyEngine {
  /**
   * Sanitizes outbound payloads to prevent any Discord IDs, Trainer IDs, Usernames, 
   * or Personal Information from leaking into the federation space.
   */
  public sanitize(rawPayload: any): any {
    const sanitized = { ...rawPayload };

    // Explicitly delete any potential private identifiers
    delete sanitized.discordId;
    delete sanitized.discordIds;
    delete sanitized.trainerId;
    delete sanitized.trainerIds;
    delete sanitized.username;
    delete sanitized.usernames;
    delete sanitized.privateMessages;
    delete sanitized.personalInformation;
    delete sanitized.clubRecords;
    delete sanitized.trainers;

    // Filter subobjects recursively if they contain user keys
    if (sanitized.metaTrends) {
      sanitized.metaTrends = { ...sanitized.metaTrends };
    }
    if (sanitized.parentDemands) {
      sanitized.parentDemands = { ...sanitized.parentDemands };
    }

    return sanitized;
  }
}
