import { createGameState, executeTurn } from "./systems/game-loop.js";
import {
  preparePlanningPhase,
  applyPlanningInput,
  createEmptySubmission,
} from "./systems/planning-system.js";
import { renderGameState } from "./ui/cli-renderer.js";
import { IRONCLAD } from "./data/champions/ironclad.js";
import { PYROX } from "./data/champions/pyrox.js";
import { ALL_PLANNING_CARDS } from "./data/cards/planning-cards.js";
import {
  GameResult,
  LaneId,
  LaneStance,
  ActionType,
} from "./types/enums.js";
import { PlayerState } from "./types/game-state.js";
import { BattleAction } from "./types/actions.js";
import { BattleState } from "./types/battle.js";
import { MINION_SPAWN_COST } from "./types/constants.js";

// Simple AI: pick a card based on lane state, spend gold on minions
function aiPlanningInput(player: PlayerState, laneId: LaneId, turnNumber: number) {
  if (!player.champions[0]?.isAlive) return null;

  const hand = player.hand;
  if (hand.length === 0) return null;

  // Strategy: alternate between aggro and economy
  let pick;
  if (turnNumber % 3 === 1) {
    // Aggro turn
    pick = hand.find((c) => c.stance === LaneStance.Aggro) ?? hand[0];
  } else if (turnNumber % 3 === 2) {
    // Economy turn
    pick = hand.find((c) => c.stance === LaneStance.Neutral) ?? hand[0];
  } else {
    // Mix it up
    pick = hand.find((c) => c.stance === LaneStance.Ambush) ??
           hand.find((c) => c.stance === LaneStance.Defend) ?? hand[0];
  }

  // Spend gold on minions (buy as many as affordable, max 2)
  const affordable = Math.min(2, Math.floor(player.gold / MINION_SPAWN_COST));

  return {
    laneId,
    cardId: pick.cardId,
    championId: player.champions[0].championId,
    minionSpawnCount: affordable,
  };
}

// Battle AI: move toward enemy, attack when in range, use abilities when possible
function battleAI(unitId: string, battle: BattleState): BattleAction {
  const bc = battle.champions.find((c) => c.championRef.championId === unitId);
  if (!bc) return { actorId: unitId, actionType: ActionType.Wait };

  const champ = bc.championRef;
  const enemy = battle.champions.find(
    (c) => c.championRef.ownerId !== champ.ownerId && c.championRef.isAlive
  );
  if (!enemy) return { actorId: unitId, actionType: ActionType.Wait };

  const myPos = champ.battlePosition!;
  const enemyPos = enemy.championRef.battlePosition!;
  const dist = Math.max(
    Math.abs(myPos.q - enemyPos.q),
    Math.abs(myPos.r - enemyPos.r),
    Math.abs(myPos.q + myPos.r - (enemyPos.q + enemyPos.r))
  );

  // Try to use an ability if in range and have energy
  for (const ability of champ.abilities) {
    if (
      ability.cooldownRemaining === 0 &&
      champ.currentEnergy >= ability.energyCost &&
      ability.baseDamage > 0 &&
      dist <= ability.range
    ) {
      return {
        actorId: unitId,
        actionType: ActionType.Ability,
        abilityId: ability.abilityId,
        targetId: enemy.championRef.championId,
        targetHex: enemyPos,
      };
    }
  }

  // Basic attack if in range
  if (dist <= champ.attackRange) {
    return {
      actorId: unitId,
      actionType: ActionType.Attack,
      targetId: enemy.championRef.championId,
    };
  }

  // Move toward enemy
  return {
    actorId: unitId,
    actionType: ActionType.Move,
    targetHex: enemyPos,
  };
}

// ── Main Demo ───────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║     MOBA BOARD GAME — AI vs AI DEMO         ║");
  console.log("║  Ironclad (Tank) vs Pyrox (Mage)            ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  const game = createGameState(IRONCLAD, PYROX, ALL_PLANNING_CARDS, [LaneId.Mid]);
  const laneId = LaneId.Mid;

  while (game.result === GameResult.InProgress) {
    console.log(renderGameState(game));

    preparePlanningPhase(game);

    // AI planning for both players
    const p1Input = aiPlanningInput(game.players[0], laneId, game.turnNumber);
    const p2Input = aiPlanningInput(game.players[1], laneId, game.turnNumber);

    const p1Sub = p1Input
      ? applyPlanningInput(p1Input, game.players[0])
      : createEmptySubmission("PLAYER_1");

    const p2Sub = p2Input
      ? applyPlanningInput(p2Input, game.players[1])
      : createEmptySubmission("PLAYER_2");

    // Log what each player chose
    if (p1Input) {
      const card = game.players[0].discard[game.players[0].discard.length - 1];
      console.log(`  P1 plays: ${card.name} [${card.stance}] + spawns ${p1Input.minionSpawnCount} minions`);
    } else {
      console.log("  P1: skips (champion dead)");
    }
    if (p2Input) {
      const card = game.players[1].discard[game.players[1].discard.length - 1];
      console.log(`  P2 plays: ${card.name} [${card.stance}] + spawns ${p2Input.minionSpawnCount} minions`);
    } else {
      console.log("  P2: skips (champion dead)");
    }

    // Execute turn
    executeTurn(game, p1Sub, p2Sub, battleAI);

    // Show turn results
    const lastLog = game.turnLog[game.turnLog.length - 1];
    const res = lastLog.resolutionResults[0];
    console.log(
      `\n  >> Minions: P1 ${res.minionCombatLog.player1MinionsStart}→${res.minionCombatLog.player1MinionsEnd}` +
      ` | P2 ${res.minionCombatLog.player2MinionsStart}→${res.minionCombatLog.player2MinionsEnd}`
    );
    console.log(`  >> Frontline: ${res.frontlineBefore} → ${res.frontlineAfter}`);
    if (res.battleTriggered && lastLog.battleResults.length > 0) {
      const battle = lastLog.battleResults[0];
      console.log(`  >> BATTLE! Winner: ${battle.winner ?? "DRAW"} | Lane push bonus: ${battle.lanePushBonus}`);
      if (battle.championDeaths.length > 0) {
        console.log(`  >> Champion killed: ${battle.championDeaths.join(", ")}`);
      }
    } else if (res.battleTriggered) {
      console.log(`  >> Battle triggered but no result (champions may not have been in lane)`);
    }
    console.log(`  >> Gold: P1=${game.players[0].gold} P2=${game.players[1].gold}`);
    console.log("─".repeat(50));
  }

  // Final state
  console.log(renderGameState(game));
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log(`║  GAME OVER: ${game.result.padEnd(32)}║`);
  console.log(`║  Turns played: ${(game.turnNumber - 1).toString().padEnd(29)}║`);
  console.log("╚══════════════════════════════════════════════╝");
}

main();
