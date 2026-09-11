import { MemoryRecord, MemoryQuery, MemorySource } from './types.js';

/**
 * WorkingMemory: Scoped exclusively to a single task execution.
 * Lifecycle: Create -> Use -> Merge Output -> Destroy.
 * Must never persist between tasks or across process resets.
 */
export class WorkingMemory implements MemorySource {
  public readonly type = 'working';
  public readonly taskId: string;
  private entries: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private _isDestroyed = false;

  constructor(taskId: string, initialData: Record<string, any> = {}) {
    this.taskId = taskId;
    for (const [k, v] of Object.entries(initialData)) {
      this.entries.set(k, v);
    }
  }

  public get isDestroyed(): boolean {
    return this._isDestroyed;
  }

  private assertNotDestroyed(): void {
    if (this._isDestroyed) {
      throw new Error(`WorkingMemory for task [${this.taskId}] has been destroyed and cannot be accessed.`);
    }
  }

  public set(key: string, value: any): void {
    this.assertNotDestroyed();
    this.entries.set(key, value);
  }

  public get(key: string): any {
    this.assertNotDestroyed();
    return this.entries.get(key);
  }

  public has(key: string): boolean {
    this.assertNotDestroyed();
    return this.entries.has(key);
  }

  public delete(key: string): boolean {
    this.assertNotDestroyed();
    return this.entries.delete(key);
  }

  public getAll(): Record<string, any> {
    this.assertNotDestroyed();
    return Object.fromEntries(this.entries.entries());
  }

  /**
   * Records a task-level output to be merged into execution state outputs upon completion.
   */
  public mergeOutput(key: string, value: any): void {
    this.assertNotDestroyed();
    this.outputs.set(key, value);
    this.entries.set(key, value);
  }

  public getOutputs(): Record<string, any> {
    if (this._isDestroyed) return {};
    return Object.fromEntries(this.outputs.entries());
  }

  /**
   * Destroys working memory completely, clearing all data.
   */
  public destroy(): void {
    if (this._isDestroyed) return;
    this.entries.clear();
    this.outputs.clear();
    this._isDestroyed = true;
  }

  public async query(query: MemoryQuery): Promise<MemoryRecord[]> {
    if (this._isDestroyed) return [];
    if (query.task.id !== this.taskId) return [];

    const records: MemoryRecord[] = [];
    for (const [k, v] of this.entries.entries()) {
      records.push({
        id: `working-${this.taskId}-${k}`,
        type: 'working',
        content: typeof v === 'string' ? v : JSON.stringify(v),
        taskId: this.taskId,
        key: k,
        priority: 0.8,
        metadata: { rawValue: v },
      });
    }
    return records;
  }
}
