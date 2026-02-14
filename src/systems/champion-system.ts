import { Champion, ChampionDefinition } from "../types/champion.js";
import { PlayerId } from "../types/enums.js";
import { MAX_ENERGY, LEVEL_UP_XP_COST, RESPAWN_TIMER } from "../types/constants.js";

export function createChampionFromDefinition(
  def: ChampionDefinition,
  ownerId: PlayerId
): Champion {
  return {
    ...def,
    ownerId,
    currentHp: def.maxHp,
    currentEnergy: def.maxEnergy,
    level: 1,
    xp: 0,
    abilities: def.abilities.map((a) => ({ ...a, cooldownRemaining: 0 })),
    assignedLane: null,
    laneStance: null,
    currentZone: null,
    battlePosition: null,
    isAlive: true,
    respawnTimer: 0,
    statusEffects: [],
  };
}

export function tickRespawn(champion: Champion): void {
  if (champion.respawnTimer > 0) {
    champion.respawnTimer -= 1;
    if (champion.respawnTimer === 0) {
      champion.isAlive = true;
      champion.currentHp = champion.maxHp;
      champion.currentEnergy = champion.maxEnergy;
      champion.statusEffects = [];
    }
  }
}

export function tickCooldowns(champion: Champion): void {
  for (const ability of champion.abilities) {
    if (ability.cooldownRemaining > 0) {
      ability.cooldownRemaining -= 1;
    }
  }
}

export function killChampion(champion: Champion): void {
  champion.isAlive = false;
  champion.currentHp = 0;
  champion.respawnTimer = RESPAWN_TIMER;
  champion.battlePosition = null;
  champion.assignedLane = null;
  champion.laneStance = null;
  champion.currentZone = null;
}

export function checkLevelUp(champion: Champion): boolean {
  if (champion.level >= LEVEL_UP_XP_COST.length) return false;
  if (champion.xp >= LEVEL_UP_XP_COST[champion.level]) {
    champion.level += 1;
    applyLevelUpBonus(champion);
    return true;
  }
  return false;
}

function applyLevelUpBonus(champion: Champion): void {
  // Each level grants: +2 maxHp, +1 attackDamage, +1 maxEnergy
  champion.maxHp += 2;
  champion.currentHp = Math.min(champion.currentHp + 2, champion.maxHp);
  champion.attackDamage += 1;
  champion.maxEnergy += 1;
}

export function resetChampionLaneState(champion: Champion): void {
  champion.assignedLane = null;
  champion.laneStance = null;
  champion.currentZone = null;
  champion.battlePosition = null;
}
