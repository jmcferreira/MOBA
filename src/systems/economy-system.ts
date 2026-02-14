import { PlayerId } from "../types/enums.js";
import { PlayerState } from "../types/game-state.js";
import {
  PASSIVE_GOLD_PER_TURN,
  MINION_SPAWN_COST,
  MAX_MINIONS_PER_SPAWN,
  MINION_KILL_GOLD,
  CHAMPION_KILL_GOLD,
} from "../types/constants.js";
import { MinionSpawnOrder } from "../types/planning.js";

export function canAffordSpawn(player: PlayerState, orders: MinionSpawnOrder[]): boolean {
  const totalCost = orders.reduce((sum, o) => sum + o.count * MINION_SPAWN_COST, 0);
  return player.gold >= totalCost;
}

export function validateSpawnOrders(
  player: PlayerState,
  orders: MinionSpawnOrder[]
): string | null {
  for (const order of orders) {
    if (order.count < 0) return `Negative spawn count in lane ${order.laneId}`;
    if (order.count > MAX_MINIONS_PER_SPAWN)
      return `Cannot spawn more than ${MAX_MINIONS_PER_SPAWN} minions per lane`;
  }
  if (!canAffordSpawn(player, orders)) {
    const totalCost = orders.reduce((sum, o) => sum + o.count * MINION_SPAWN_COST, 0);
    return `Not enough gold: need ${totalCost}, have ${player.gold}`;
  }
  return null;
}

export function deductSpawnCost(player: PlayerState, orders: MinionSpawnOrder[]): void {
  const totalCost = orders.reduce((sum, o) => sum + o.count * MINION_SPAWN_COST, 0);
  player.gold -= totalCost;
}

export function awardPassiveGold(player: PlayerState): void {
  player.gold += PASSIVE_GOLD_PER_TURN;
}

export function awardMinionKillGold(player: PlayerState, killCount: number): void {
  player.gold += killCount * MINION_KILL_GOLD;
}

export function awardChampionKillGold(player: PlayerState): void {
  player.gold += CHAMPION_KILL_GOLD;
}
