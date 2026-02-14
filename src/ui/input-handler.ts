import * as readline from "readline";
import { PlayerState } from "../types/game-state.js";
import { LaneId, ActionType } from "../types/enums.js";
import { PlanningInput } from "../systems/planning-system.js";
import { BattleAction } from "../types/actions.js";
import { BattleState } from "../types/battle.js";
import { renderHand, renderBattleGrid } from "./cli-renderer.js";
import { MAX_MINIONS_PER_SPAWN, MINION_SPAWN_COST } from "../types/constants.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

export async function getPlanningInput(
  player: PlayerState,
  laneId: LaneId
): Promise<PlanningInput> {
  console.log(renderHand(player));
  console.log(`\nGold: ${player.gold} | Lane: ${laneId}`);

  const champion = player.champions[0];
  if (!champion || !champion.isAlive) {
    console.log("Champion is dead. Skipping planning.");
    return {
      laneId,
      cardId: "",
      championId: "",
      minionSpawnCount: 0,
    };
  }

  // Select card
  let cardIdx: number;
  while (true) {
    const input = await question(`Select card (1-${player.hand.length}): `);
    cardIdx = parseInt(input) - 1;
    if (cardIdx >= 0 && cardIdx < player.hand.length) break;
    console.log("Invalid selection.");
  }
  const card = player.hand[cardIdx];

  // Select minion spawns
  const maxAffordable = Math.min(
    MAX_MINIONS_PER_SPAWN,
    Math.floor(player.gold / MINION_SPAWN_COST)
  );
  let spawnCount = 0;
  if (maxAffordable > 0) {
    const input = await question(
      `Spawn minions (0-${maxAffordable}, cost ${MINION_SPAWN_COST}g each): `
    );
    spawnCount = parseInt(input) || 0;
    spawnCount = Math.max(0, Math.min(spawnCount, maxAffordable));
  }

  return {
    laneId,
    cardId: card.cardId,
    championId: champion.championId,
    minionSpawnCount: spawnCount,
  };
}

export async function getBattleAction(
  unitId: string,
  battle: BattleState
): Promise<BattleAction> {
  console.log(renderBattleGrid(battle));
  console.log(`\n${unitId}'s turn:`);
  console.log("  1. Move    2. Attack    3. Ability    4. Defend    5. Wait");

  const input = await question("Action: ");
  const choice = parseInt(input);

  switch (choice) {
    case 1: {
      const qr = await question("Move to (q,r): ");
      const [q, r] = qr.split(",").map(Number);
      return {
        actorId: unitId,
        actionType: ActionType.Move,
        targetHex: { q, r },
      };
    }
    case 2: {
      const tid = await question("Target unit ID: ");
      return {
        actorId: unitId,
        actionType: ActionType.Attack,
        targetId: tid,
      };
    }
    case 3: {
      const aid = await question("Ability ID: ");
      const tid2 = await question("Target unit ID (or empty): ");
      const hexInput = await question("Target hex (q,r or empty): ");
      const targetHex = hexInput
        ? { q: parseInt(hexInput.split(",")[0]), r: parseInt(hexInput.split(",")[1]) }
        : undefined;
      return {
        actorId: unitId,
        actionType: ActionType.Ability,
        abilityId: aid,
        targetId: tid2 || undefined,
        targetHex,
      };
    }
    case 4:
      return { actorId: unitId, actionType: ActionType.Defend };
    case 5:
    default:
      return { actorId: unitId, actionType: ActionType.Wait };
  }
}

export function closeInput(): void {
  rl.close();
}
