import { KnowledgeSource } from './knowledge-source.js';

export class KnowledgeRegistry {
  private sources = new Map<string, KnowledgeSource>();

  public register(source: KnowledgeSource): void {
    this.sources.set(source.id, source);
  }

  public unregister(id: string): boolean {
    return this.sources.delete(id);
  }

  public get(id: string): KnowledgeSource | undefined {
    return this.sources.get(id);
  }

  public getAll(): KnowledgeSource[] {
    return Array.from(this.sources.values());
  }

  public getByType(type: string): KnowledgeSource[] {
    return this.getAll().filter(s => s.type === type);
  }

  public clear(): void {
    this.sources.clear();
  }
}
