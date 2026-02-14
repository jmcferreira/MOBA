import { PlayerId, LaneId } from "../types/enums.js";
import { PlayerState, GameState } from "../types/game-state.js";
import { PlanningSubmission, LaneAssignment, MinionSpawnOrder } from "../types/planning.js";
import { PlanningCard } from "../types/card.js";
import { Champion } from "../types/champion.js";
import { drawToHandLimit, playCard } from "./card-system.js";
import { validateSpawnOrders, deductSpawnCost } from "./economy-system.js";
import { MAX_MINIONS_PER_SPAWN } from "../types/constants.js";

export interface PlanningInput {
  laneId: LaneId;
  cardId: string;
  championId: string;
  minionSpawnCount: number;
}

export function validatePlanningInput(
  input: PlanningInput,
  player: PlayerState
): string | null {
  // Card must be in hand
  const card = player.hand.find((c) => c.cardId === input.cardId);
  if (!card) return `Card ${input.cardId} not in hand`;

  // Champion must be alive
  const champ = player.champions.find((c) => c.championId === input.championId);
  if (!champ) return `Champion ${input.championId} not found`;
  if (!champ.isAlive) return `Champion ${input.championId} is dead (respawning)`;

  // Spawn count valid
  if (input.minionSpawnCount < 0) return "Negative spawn count";
  if (input.minionSpawnCount > MAX_MINIONS_PER_SPAWN)
    return `Cannot spawn more than ${MAX_MINIONS_PER_SPAWN} minions`;

  const spawnOrders: MinionSpawnOrder[] = [
    { laneId: input.laneId, count: input.minionSpawnCount },
  ];
  const err = validateSpawnOrders(player, spawnOrders);
  if (err) return err;

  return null;
}

export function applyPlanningInput(
  input: PlanningInput,
  player: PlayerState
): PlanningSubmission {
  // Play card from hand
  const card = playCard(player, input.cardId);

  // Assign champion
  const champ = player.champions.find((c) => c.championId === input.championId)!;
  champ.assignedLane = input.laneId;
  champ.laneStance = card!.stance;

  // Deduct spawn cost
  const spawnOrders: MinionSpawnOrder[] = [
    { laneId: input.laneId, count: input.minionSpawnCount },
  ];
  deductSpawnCost(player, spawnOrders);

  return {
    playerId: player.playerId,
    laneAssignments: [
      {
        laneId: input.laneId,
        cardId: input.cardId,
        championId: input.championId,
      },
    ],
    minionSpawnOrders: spawnOrders,
  };
}

/**
 * Creates a submission for a player who has no champion alive (skip turn).
 * They still get free minion waves via resolution, but play no card.
 */
export function createEmptySubmission(playerId: PlayerId): PlanningSubmission {
  return {
    playerId,
    laneAssignments: [],
    minionSpawnOrders: [],
  };
}

export function preparePlanningPhase(gameState: GameState): void {
  for (const player of gameState.players) {
    drawToHandLimit(player);
  }
}
