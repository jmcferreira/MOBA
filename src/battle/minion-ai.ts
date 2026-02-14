import { BattleState } from "../types/battle.js";
import { BattleMinion } from "../types/minion.js";
import { HexCoord } from "../types/hex.js";
import { hexDistance } from "./hex-grid.js";
import {
  BattleUnit,
  getUnitPosition,
  executeBasicAttack,
  executeMove,
} from "./action-executor.js";

export function executeMinionTurn(minion: BattleMinion, battle: BattleState): void {
  if (!minion.isAlive) return;

  // Find nearest enemy
  const enemies = getEnemyUnits(minion.ownerId, battle);
  if (enemies.length === 0) return;

  // Sort by priority: champions first, then by distance
  const minionPos = minion.position;
  enemies.sort((a, b) => {
    const aIsChamp = a.kind === "champion" ? 0 : 1;
    const bIsChamp = b.kind === "champion" ? 0 : 1;
    if (aIsChamp !== bIsChamp) return aIsChamp - bIsChamp;
    return hexDistance(minionPos, getUnitPosition(a)) - hexDistance(minionPos, getUnitPosition(b));
  });

  const nearest = enemies[0];
  const dist = hexDistance(minionPos, getUnitPosition(nearest));

  if (dist <= 1) {
    // Attack
    executeBasicAttack({ kind: "minion", ref: minion }, nearest, battle);
  } else {
    // Move toward nearest enemy (1 hex)
    executeMove(
      { kind: "minion", ref: minion },
      getUnitPosition(nearest),
      battle,
      1
    );
  }
}

function getEnemyUnits(ownerId: string, battle: BattleState): BattleUnit[] {
  const enemies: BattleUnit[] = [];

  for (const bc of battle.champions) {
    if (bc.championRef.isAlive && bc.championRef.ownerId !== ownerId) {
      enemies.push({ kind: "champion", ref: bc.championRef });
    }
  }

  for (const m of battle.minions) {
    if (m.isAlive && m.ownerId !== ownerId) {
      enemies.push({ kind: "minion", ref: m });
    }
  }

  return enemies;
}
