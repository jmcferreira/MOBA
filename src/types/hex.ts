import { HexTerrain } from "./enums.js";

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexCell {
  coord: HexCoord;
  terrain: HexTerrain;
  occupantId: string | null;
}

export interface HexGrid {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
}

export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];
