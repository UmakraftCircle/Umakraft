import { DatabaseKnowledgeResult, DatabaseEntityType, UserSecurityContext } from './database-result.js';

export type AccessAction = 'read' | 'write' | 'delete' | 'admin';

export interface ResourceAccessPolicy {
  entityType: DatabaseEntityType | string;
  minimumRole: 'public' | 'member' | 'officer' | 'admin' | 'super_admin';
  allowOwnerAccess?: boolean;
  restrictedFields?: string[];
}

export class DatabaseAuthorizationService {
  private policies = new Map<string, ResourceAccessPolicy>();

  constructor() {
    this.registerDefaultPolicies();
  }

  private registerDefaultPolicies(): void {
    // Publicly accessible data
    this.policies.set('leaderboard', { entityType: 'leaderboard', minimumRole: 'public' });
    this.policies.set('club', { entityType: 'club', minimumRole: 'public' });
    this.policies.set('milestone', { entityType: 'milestone', minimumRole: 'public' });

    // Member & trainer public profiles
    this.policies.set('trainer', { entityType: 'trainer', minimumRole: 'public', allowOwnerAccess: true });
    this.policies.set('member', { entityType: 'member', minimumRole: 'public', allowOwnerAccess: true });
    this.policies.set('fan_gain', { entityType: 'fan_gain', minimumRole: 'member', allowOwnerAccess: true });
    this.policies.set('fan_deficit', { entityType: 'fan_deficit', minimumRole: 'member', allowOwnerAccess: true });
    this.policies.set('fan_surplus', { entityType: 'fan_surplus', minimumRole: 'member', allowOwnerAccess: true });
    this.policies.set('link_request', { entityType: 'link_request', minimumRole: 'member', allowOwnerAccess: true });
    this.policies.set('composite_status', { entityType: 'composite_status', minimumRole: 'member', allowOwnerAccess: true });

    // Restricted Officer/Admin data
    this.policies.set('attendance', { entityType: 'attendance', minimumRole: 'officer' });
    this.policies.set('activity_tracking', { entityType: 'activity_tracking', minimumRole: 'officer' });
    this.policies.set('bot_configuration', { entityType: 'bot_configuration', minimumRole: 'admin' });
    this.policies.set('admin_notes', { entityType: 'admin_notes', minimumRole: 'admin' });
  }

  public registerPolicy(policy: ResourceAccessPolicy): void {
    this.policies.set(policy.entityType, policy);
  }

  private getRoleWeight(role?: string): number {
    switch (role) {
      case 'super_admin': return 100;
      case 'admin': return 80;
      case 'officer': return 60;
      case 'member': return 40;
      case 'public':
      default: return 10;
    }
  }

  private getUserHighestRole(userContext?: UserSecurityContext): string {
    if (!userContext) return 'public';
    if (userContext.isAdmin) return 'admin';
    if (userContext.isOfficer) return 'officer';

    if (userContext.roles && userContext.roles.length > 0) {
      let highestRole = 'public';
      let highestWeight = 10;
      for (const r of userContext.roles) {
        const w = this.getRoleWeight(r);
        if (w > highestWeight) {
          highestWeight = w;
          highestRole = r;
        }
      }
      return highestRole;
    }

    if (userContext.trainerId || userContext.discordUserId || userContext.userId) {
      return 'member';
    }

    return 'public';
  }

  public canAccess(
    entityType: DatabaseEntityType | string,
    action: AccessAction = 'read',
    userContext?: UserSecurityContext,
    resourceOwnerId?: string
  ): boolean {
    const policy = this.policies.get(entityType);
    if (!policy) {
      // Default to member-level access if not defined
      return true;
    }

    const userRole = this.getUserHighestRole(userContext);
    const userWeight = this.getRoleWeight(userRole);
    const requiredWeight = this.getRoleWeight(policy.minimumRole);

    if (userWeight >= requiredWeight) {
      return true;
    }

    // Check owner access
    if (policy.allowOwnerAccess && resourceOwnerId && userContext) {
      if (
        userContext.trainerId === resourceOwnerId ||
        userContext.discordUserId === resourceOwnerId ||
        userContext.userId === resourceOwnerId
      ) {
        return true;
      }
    }

    // Public entity types are accessible by default
    if (policy.minimumRole === 'public') {
      return true;
    }

    return false;
  }

  public filterResults(
    results: DatabaseKnowledgeResult[],
    userContext?: UserSecurityContext
  ): DatabaseKnowledgeResult[] {
    return results.filter(res => {
      const ownerId = res.entityId || (res.metadata?.ownerId as string) || (res.metadata?.trainerId as string);
      return this.canAccess(res.entityType, 'read', userContext, ownerId);
    });
  }

  public sanitizePayload<T = unknown>(
    entityType: string,
    payload: T,
    userContext?: UserSecurityContext
  ): T {
    if (!payload || typeof payload !== 'object') return payload;

    const policy = this.policies.get(entityType);
    const isPrivileged = userContext?.isAdmin || userContext?.isOfficer;

    if (policy?.restrictedFields && !isPrivileged) {
      const sanitized = { ...(payload as Record<string, unknown>) };
      for (const field of policy.restrictedFields) {
        delete sanitized[field];
      }
      return sanitized as T;
    }

    return payload;
  }
}
