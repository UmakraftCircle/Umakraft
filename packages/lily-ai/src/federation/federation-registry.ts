import { FederationNode, TrustLevel } from './federation-types.js';

export class FederationRegistry {
  private nodes = new Map<string, FederationNode>();

  constructor() {
    // Seed some initial nodes for realistic federation testing
    this.register({
      id: 'umakraft_sea',
      name: 'Umakraft SEA Hub',
      region: 'SEA',
      trustLevel: TrustLevel.VERIFIED,
      enabled: true
    });
    this.register({
      id: 'node_jp_east',
      name: 'Trezen JP East Community',
      region: 'JP',
      trustLevel: TrustLevel.TRUSTED,
      enabled: true
    });
    this.register({
      id: 'node_na_west',
      name: 'West Coast Trainers',
      region: 'NA',
      trustLevel: TrustLevel.COMMUNITY,
      enabled: true
    });
  }

  public register(node: FederationNode): void {
    this.nodes.set(node.id, node);
  }

  public get(nodeId: string): FederationNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAll(): FederationNode[] {
    return Array.from(this.nodes.values()).filter(n => n.enabled);
  }
}
