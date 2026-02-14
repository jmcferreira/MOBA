import { createGameState, executeTurn, checkWinCondition } from "./systems/game-loop.js";
import { preparePlanningPhase, applyPlanningInput, createEmptySubmission, validatePlanningInput } from "./systems/planning-system.js";
import { renderGameState } from "./ui/cli-renderer.js";
import { getPlanningInput, getBattleAction, closeInput } from "./ui/input-handler.js";
import { IRONCLAD } from "./data/champions/ironclad.js";
import { PYROX } from "./data/champions/pyrox.js";
import { ALL_PLANNING_CARDS } from "./data/cards/planning-cards.js";
import { GameResult, LaneId } from "./types/enums.js";
import { BattleAction } from "./types/actions.js";
import { BattleState } from "./types/battle.js";
import { ActionType } from "./types/enums.js";

async function main() {
  console.log("=== MOBA Board Game ===");
  console.log("Player 1: Ironclad (Tank) | Player 2: Pyrox (Mage)");
  console.log("Objective: Destroy the enemy base!\n");

  const gameState = createGameState(IRONCLAD, PYROX, ALL_PLANNING_CARDS, [LaneId.Mid]);
  const laneId = LaneId.Mid;

  while (gameState.result === GameResult.InProgress) {
    // Show game state
    console.log(renderGameState(gameState));

    // Planning phase
    preparePlanningPhase(gameState);

    // Player 1 planning
    console.log("\n--- Player 1's Planning Phase ---");
    const p1Input = await getPlanningInput(gameState.players[0], laneId);

    let p1Submission;
    if (p1Input.cardId === "") {
      p1Submission = createEmptySubmission("PLAYER_1");
    } else {
      const p1Error = validatePlanningInput(p1Input, gameState.players[0]);
      if (p1Error) {
        console.log(`Error: ${p1Error}`);
        p1Submission = createEmptySubmission("PLAYER_1");
      } else {
        p1Submission = applyPlanningInput(p1Input, gameState.players[0]);
      }
    }

    // Player 2 planning
    console.log("\n--- Player 2's Planning Phase ---");
    const p2Input = await getPlanningInput(gameState.players[1], laneId);

    let p2Submission;
    if (p2Input.cardId === "") {
      p2Submission = createEmptySubmission("PLAYER_2");
    } else {
      const p2Error = validatePlanningInput(p2Input, gameState.players[1]);
      if (p2Error) {
        console.log(`Error: ${p2Error}`);
        p2Submission = createEmptySubmission("PLAYER_2");
      } else {
        p2Submission = applyPlanningInput(p2Input, gameState.players[1]);
      }
    }

    // Battle action provider (interactive)
    const battleActionProvider = async (
      unitId: string,
      battle: BattleState
    ): Promise<BattleAction> => {
      return getBattleAction(unitId, battle);
    };

    // For MVP, use a simple AI for battle actions to avoid async complications
    // in the synchronous battle loop. Interactive battles can be added later.
    const simpleBattleAI = (unitId: string, battle: BattleState): BattleAction => {
      // Find the champion
      const bc = battle.champions.find((c) => c.championRef.championId === unitId);
      if (!bc) return { actorId: unitId, actionType: ActionType.Wait };

      const champ = bc.championRef;

      // Find nearest enemy champion
      const enemy = battle.champions.find(
        (c) => c.championRef.ownerId !== champ.ownerId && c.championRef.isAlive
      );
      if (!enemy) return { actorId: unitId, actionType: ActionType.Wait };

      const enemyPos = enemy.championRef.battlePosition!;
      const myPos = champ.battlePosition!;

      // If in attack range, attack
      const dist = Math.max(
        Math.abs(myPos.q - enemyPos.q),
        Math.abs(myPos.r - enemyPos.r),
        Math.abs(myPos.q + myPos.r - (enemyPos.q + enemyPos.r))
      );

      if (dist <= champ.attackRange) {
        return {
          actorId: unitId,
          actionType: ActionType.Attack,
          targetId: enemy.championRef.championId,
        };
      }

      // Otherwise, move toward enemy
      return {
        actorId: unitId,
        actionType: ActionType.Move,
        targetHex: enemyPos,
      };
    };

    // Execute turn
    executeTurn(gameState, p1Submission, p2Submission, simpleBattleAI);

    console.log(`\n--- Turn ${gameState.turnNumber - 1} Complete ---`);
  }

  // Game over
  console.log(renderGameState(gameState));
  console.log(`\n=== GAME OVER: ${gameState.result} ===`);
  closeInput();
}

main().catch(console.error);
