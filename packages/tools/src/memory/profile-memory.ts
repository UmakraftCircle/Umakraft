import { MemoryRecord, MemoryQuery, MemorySource } from './types.js';

export interface ProfileSetting {
  key: string;
  value: any;
  description?: string;
  tags?: string[];
  priority?: number; // Defaults to high priority (e.g. 0.9)
}

/**
 * ProfileMemory: Stores stable project configuration, architecture constraints,
 * user preferences, and repository conventions.
 */
export class ProfileMemory implements MemorySource {
  public readonly type = 'profile';
  private settings: Map<string, ProfileSetting> = new Map();

  constructor(initialSettings: Record<string, any> | ProfileSetting[] = {}) {
    if (Array.isArray(initialSettings)) {
      for (const s of initialSettings) {
        this.settings.set(s.key, s);
      }
    } else {
      for (const [k, v] of Object.entries(initialSettings)) {
        this.settings.set(k, { key: k, value: v, priority: 0.9 });
      }
    }
  }

  public set(key: string, value: any, description?: string, tags?: string[], priority = 0.9): void {
    this.settings.set(key, { key, value, description, tags, priority });
  }

  public get(key: string): any {
    return this.settings.get(key)?.value;
  }

  public getAll(): Record<string, any> {
    const res: Record<string, any> = {};
    for (const [k, v] of this.settings.entries()) {
      res[k] = v.value;
    }
    return res;
  }

  public async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    const taskNameLower = (query.task.name || '').toLowerCase();
    const taskArgsStr = JSON.stringify(query.task.arguments || {}).toLowerCase();
    const keywords = (query.keywords || []).map((k) => k.toLowerCase());

    const records: MemoryRecord[] = [];

    for (const setting of this.settings.values()) {
      const keyLower = setting.key.toLowerCase();
      let matched = false;

      if (keywords.length > 0) {
        matched = keywords.some((k) => keyLower.includes(k) || (setting.tags && setting.tags.some((t) => t.toLowerCase().includes(k))));
      } else {
        // Match key against task name or task arguments
        matched = taskNameLower.includes(keyLower) || taskArgsStr.includes(keyLower);
      }

      if (matched) {
        records.push({
          id: `profile-${setting.key}`,
          type: 'profile',
          content: typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value),
          priority: setting.priority ?? 0.9,
          key: setting.key,
          tags: setting.tags,
          metadata: {
            description: setting.description,
            rawValue: setting.value,
          },
        });
      }
    }

    return records;
  }
}
