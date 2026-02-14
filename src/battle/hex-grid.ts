import { HexTerrain } from "../types/enums.js";
import { HexCoord, HexCell, HexGrid, HEX_DIRECTIONS } from "../types/hex.js";

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - (b.q + b.r))
  );
}

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexEquals(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function createHexGrid(width: number, height: number): HexGrid {
  const cells = new Map<string, HexCell>();

  for (let q = 0; q < width; q++) {
    for (let r = 0; r < height; r++) {
      const coord: HexCoord = { q, r };
      cells.set(hexKey(coord), {
        coord,
        terrain: HexTerrain.Open,
        occupantId: null,
      });
    }
  }

  return { width, height, cells };
}

export function getCell(grid: HexGrid, coord: HexCoord): HexCell | undefined {
  return grid.cells.get(hexKey(coord));
}

export function isValidHex(grid: HexGrid, coord: HexCoord): boolean {
  return grid.cells.has(hexKey(coord));
}

export function isPassable(grid: HexGrid, coord: HexCoord): boolean {
  const cell = getCell(grid, coord);
  if (!cell) return false;
  return cell.terrain !== HexTerrain.Blocked && cell.occupantId === null;
}

export function getReachableHexes(
  grid: HexGrid,
  start: HexCoord,
  maxDistance: number
): HexCoord[] {
  const visited = new Set<string>();
  const reachable: HexCoord[] = [];
  const queue: { coord: HexCoord; dist: number }[] = [{ coord: start, dist: 0 }];
  visited.add(hexKey(start));

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.dist > 0) {
      reachable.push(current.coord);
    }
    if (current.dist >= maxDistance) continue;

    for (const neighbor of hexNeighbors(current.coord)) {
      const key = hexKey(neighbor);
      if (!visited.has(key) && isPassable(grid, neighbor)) {
        visited.add(key);
        queue.push({ coord: neighbor, dist: current.dist + 1 });
      }
    }
  }

  return reachable;
}

export function findPath(
  grid: HexGrid,
  start: HexCoord,
  goal: HexCoord,
  maxSteps: number
): HexCoord[] {
  if (hexEquals(start, goal)) return [start];

  const visited = new Map<string, string | null>();
  const queue: HexCoord[] = [start];
  visited.set(hexKey(start), null);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (hexEquals(current, goal)) {
      // Reconstruct path
      const path: HexCoord[] = [];
      let node: HexCoord | null = current;
      while (node !== null) {
        path.unshift(node);
        const parentKey = visited.get(hexKey(node));
        node = parentKey
          ? { q: parseInt(parentKey.split(",")[0]), r: parseInt(parentKey.split(",")[1]) }
          : null;
      }
      // Trim to maxSteps (start doesn't count as a step)
      return path.slice(0, maxSteps + 1);
    }

    for (const neighbor of hexNeighbors(current)) {
      const key = hexKey(neighbor);
      if (!visited.has(key) && (isPassable(grid, neighbor) || hexEquals(neighbor, goal))) {
        visited.set(key, hexKey(current));
        queue.push(neighbor);
      }
    }
  }

  // No path to goal; return path to closest reachable hex
  return [start];
}
