export enum BlockType {
  air = 0,
  dirt = 1,
  grass = 2,
  stone = 3,
  wood = 4,
  leaves = 5,
  planks = 6,
  glass = 7,
  cobblestone = 8,
  sand = 9,
  water = 10,
}

export const BlockMap: Record<BlockType, string> = {
  [BlockType.air]: 'Air',
  [BlockType.dirt]: 'Dirt',
  [BlockType.grass]: 'Grass',
  [BlockType.stone]: 'Stone',
  [BlockType.wood]: 'Log',
  [BlockType.leaves]: 'Leaves',
  [BlockType.planks]: 'Planks',
  [BlockType.glass]: 'Glass',
  [BlockType.cobblestone]: 'Cobblestone',
  [BlockType.sand]: 'Sand',
  [BlockType.water]: 'Water',
};

export type Position = [number, number, number];

export interface BlockData {
  id: string;
  pos: Position;
  type: BlockType;
}
