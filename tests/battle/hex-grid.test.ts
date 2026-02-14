import { describe, it, expect } from "vitest";
import {
  hexDistance,
  hexNeighbors,
  hexAdd,
  hexEquals,
  hexKey,
  createHexGrid,
  getCell,
  isValidHex,
  isPassable,
  getReachableHexes,
  findPath,
} from "../../src/battle/hex-grid.js";
import { HexTerrain } from "../../src/types/enums.js";
import { HexCoord } from "../../src/types/hex.js";

describe("hexKey", () => {
  it("produces a unique string for each coordinate", () => {
    expect(hexKey({ q: 0, r: 0 })).toBe("0,0");
    expect(hexKey({ q: 3, r: -1 })).toBe("3,-1");
  });
});

describe("hexDistance", () => {
  it("returns 0 for the same hex", () => {
    expect(hexDistance({ q: 2, r: 3 }, { q: 2, r: 3 })).toBe(0);
  });

  it("returns 1 for adjacent hexes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 1 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
  });

  it("calculates correct distance for non-adjacent hexes", () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 2 })).toBe(4);
    expect(hexDistance({ q: 1, r: 1 }, { q: 4, r: -1 })).toBe(3);
  });
});

describe("hexNeighbors", () => {
  it("returns exactly 6 neighbors", () => {
    const neighbors = hexNeighbors({ q: 3, r: 3 });
    expect(neighbors).toHaveLength(6);
  });

  it("all neighbors are at distance 1", () => {
    const origin: HexCoord = { q: 2, r: 2 };
    for (const n of hexNeighbors(origin)) {
      expect(hexDistance(origin, n)).toBe(1);
    }
  });
});

describe("hexAdd / hexEquals", () => {
  it("adds coordinates", () => {
    expect(hexAdd({ q: 1, r: 2 }, { q: 3, r: -1 })).toEqual({ q: 4, r: 1 });
  });

  it("equality check works", () => {
    expect(hexEquals({ q: 1, r: 2 }, { q: 1, r: 2 })).toBe(true);
    expect(hexEquals({ q: 1, r: 2 }, { q: 2, r: 1 })).toBe(false);
  });
});

describe("createHexGrid", () => {
  it("creates a grid with the correct number of cells", () => {
    const grid = createHexGrid(7, 5);
    expect(grid.cells.size).toBe(35);
    expect(grid.width).toBe(7);
    expect(grid.height).toBe(5);
  });

  it("all cells default to Open terrain with no occupant", () => {
    const grid = createHexGrid(3, 3);
    for (const cell of grid.cells.values()) {
      expect(cell.terrain).toBe(HexTerrain.Open);
      expect(cell.occupantId).toBeNull();
    }
  });
});

describe("getCell / isValidHex", () => {
  it("returns a cell for valid coordinates", () => {
    const grid = createHexGrid(7, 5);
    const cell = getCell(grid, { q: 3, r: 2 });
    expect(cell).toBeDefined();
    expect(cell!.coord).toEqual({ q: 3, r: 2 });
  });

  it("returns undefined for out-of-bounds", () => {
    const grid = createHexGrid(7, 5);
    expect(getCell(grid, { q: 7, r: 0 })).toBeUndefined();
    expect(isValidHex(grid, { q: -1, r: 0 })).toBe(false);
  });
});

describe("isPassable", () => {
  it("returns true for open, unoccupied cells", () => {
    const grid = createHexGrid(3, 3);
    expect(isPassable(grid, { q: 1, r: 1 })).toBe(true);
  });

  it("returns false for blocked cells", () => {
    const grid = createHexGrid(3, 3);
    getCell(grid, { q: 1, r: 1 })!.terrain = HexTerrain.Blocked;
    expect(isPassable(grid, { q: 1, r: 1 })).toBe(false);
  });

  it("returns false for occupied cells", () => {
    const grid = createHexGrid(3, 3);
    getCell(grid, { q: 1, r: 1 })!.occupantId = "unit_1";
    expect(isPassable(grid, { q: 1, r: 1 })).toBe(false);
  });

  it("returns false for out-of-bounds", () => {
    const grid = createHexGrid(3, 3);
    expect(isPassable(grid, { q: 10, r: 10 })).toBe(false);
  });
});

describe("getReachableHexes", () => {
  it("returns adjacent hexes for distance 1", () => {
    const grid = createHexGrid(5, 5);
    const reachable = getReachableHexes(grid, { q: 2, r: 2 }, 1);
    expect(reachable.length).toBe(6);
    for (const h of reachable) {
      expect(hexDistance({ q: 2, r: 2 }, h)).toBe(1);
    }
  });

  it("does not include blocked hexes", () => {
    const grid = createHexGrid(5, 5);
    // Block all immediate neighbors except one
    for (const n of hexNeighbors({ q: 2, r: 2 })) {
      if (!(n.q === 3 && n.r === 2)) {
        getCell(grid, n)!.terrain = HexTerrain.Blocked;
      }
    }
    const reachable = getReachableHexes(grid, { q: 2, r: 2 }, 1);
    expect(reachable.length).toBe(1);
    expect(reachable[0]).toEqual({ q: 3, r: 2 });
  });

  it("does not include the start hex", () => {
    const grid = createHexGrid(5, 5);
    const reachable = getReachableHexes(grid, { q: 2, r: 2 }, 2);
    expect(reachable.find((h) => h.q === 2 && h.r === 2)).toBeUndefined();
  });
});

describe("findPath", () => {
  it("returns start when start equals goal", () => {
    const grid = createHexGrid(5, 5);
    const path = findPath(grid, { q: 2, r: 2 }, { q: 2, r: 2 }, 3);
    expect(path).toEqual([{ q: 2, r: 2 }]);
  });

  it("finds a direct path to an adjacent hex", () => {
    const grid = createHexGrid(5, 5);
    const path = findPath(grid, { q: 2, r: 2 }, { q: 3, r: 2 }, 3);
    expect(path.length).toBe(2);
    expect(path[0]).toEqual({ q: 2, r: 2 });
    expect(path[1]).toEqual({ q: 3, r: 2 });
  });

  it("respects maxSteps limit", () => {
    const grid = createHexGrid(7, 5);
    const path = findPath(grid, { q: 0, r: 2 }, { q: 6, r: 2 }, 2);
    // Path should include start + at most 2 steps
    expect(path.length).toBeLessThanOrEqual(3);
  });

  it("navigates around obstacles", () => {
    const grid = createHexGrid(5, 5);
    // Block the direct path
    getCell(grid, { q: 2, r: 2 })!.terrain = HexTerrain.Blocked;
    const path = findPath(grid, { q: 1, r: 2 }, { q: 3, r: 2 }, 10);
    expect(path.length).toBeGreaterThan(2); // Must go around
    // Should not include the blocked hex
    expect(path.find((h) => h.q === 2 && h.r === 2)).toBeUndefined();
  });
});
