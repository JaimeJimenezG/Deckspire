export type NodeType = 'combat' | 'elite' | 'rest' | 'shop' | 'treasure' | 'event' | 'boss';

export interface MapNode {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  readonly type: NodeType;
  readonly connections: readonly string[];
  readonly visited: boolean;
}

export interface GameMap {
  readonly nodes: ReadonlyMap<string, MapNode>;
  readonly currentNodeId: string | null;
  readonly act: number;
  readonly bossId: string;
}
