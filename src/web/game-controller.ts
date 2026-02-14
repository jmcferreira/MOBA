/**
 * Browser-side game controller. Wraps the core game logic
 * and exposes a simple API for the Canvas UI to call.
 */
import { createGameState, executeTurn, checkWinCondition, BattleRunner } from "../systems/game-loop.js";
import {
  preparePlanningPhase,
  applyPlanningInput,
  createEmptySubmission,
  PlanningInput,
} from "../systems/planning-system.js";
import { IRONCLAD } from "../data/champions/ironclad.js";
import { PYROX } from "../data/champions/pyrox.js";
import { ALL_PLANNING_CARDS } from "../data/cards/planning-cards.js";
import {
  GameResult,
  LaneId,
  LaneStance,
  ActionType,
  PlayerId,
} from "../types/enums.js";
import { GameState } from "../types/game-state.js";
import { BattleAction } from "../types/actions.js";
import { BattleState, BattleOutcome } from "../types/battle.js";
import { PlanningSubmission } from "../types/planning.js";
import { PlanningCard } from "../types/card.js";
import { TurnLogEntry } from "../types/log.js";
import { LaneState } from "../types/lane.js";
import { Champion } from "../types/champion.js";
import { MINION_SPAWN_COST, MAX_MINIONS_PER_SPAWN, BATTLE_ROUND_LIMIT } from "../types/constants.js";
import { resetIdCounter } from "../utils/id-generator.js";
import { setupBattle, executeBattleRound, calculateBattleOutcome, ActionProvider } from "../systems/battle-system.js";
import { findUnitById } from "../battle/action-executor.js";

export type GamePhase = "P1_PLANNING" | "P2_PLANNING" | "RESOLVING" | "BATTLE_REPLAY" | "GAME_OVER";

export interface BattleFrameAction {
  actorId: string;
  actionType: ActionType;
  targetId?: string;
  description: string;
}

export interface BattleFrame {
  battleState: BattleState;
  action: BattleFrameAction | null;
}

export interface UIState {
  gameState: GameState;
  phase: GamePhase;
  p1Submission: PlanningSubmission | null;
  lastTurnLog: TurnLogEntry | null;
  message: string;
  battleFrames: BattleFrame[];
}

// ── Battle AI ──────────────────────────────────────────────

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

  if (dist <= champ.attackRange) {
    return {
      actorId: unitId,
      actionType: ActionType.Attack,
      targetId: enemy.championRef.championId,
    };
  }

  return {
    actorId: unitId,
    actionType: ActionType.Move,
    targetHex: enemyPos,
  };
}

// ── Battle Recording ───────────────────────────────────────

function runBattleRecorded(
  laneId: LaneId,
  lane: LaneState,
  p1Champion: Champion,
  p2Champion: Champion,
  p1Stance: LaneStance,
  p2Stance: LaneStance,
  actionProvider: ActionProvider
): { outcome: BattleOutcome; frames: BattleFrame[] } {
  const battle = setupBattle(laneId, lane, p1Champion, p2Champion, p1Stance, p2Stance);
  const frames: BattleFrame[] = [];

  // Initial frame
  frames.push({ battleState: structuredClone(battle), action: null });

  // Run rounds — capture state after each round
  while (!battle.isComplete && battle.roundNumber <= BATTLE_ROUND_LIMIT) {
    const roundNum = battle.roundNumber;
    executeBattleRound(battle, actionProvider);

    frames.push({
      battleState: structuredClone(battle),
      action: {
        actorId: "",
        actionType: ActionType.Wait,
        description: battle.isComplete
          ? "Battle ends!"
          : `Round ${roundNum} complete`,
      },
    });
  }

  const outcome = calculateBattleOutcome(battle);
  battle.outcome = outcome;

  frames.push({
    battleState: structuredClone(battle),
    action: {
      actorId: "",
      actionType: ActionType.Wait,
      description: outcome.winner
        ? `${outcome.winner === "PLAYER_1" ? "Player 1" : "Player 2"} wins the battle!`
        : "Battle ends in a draw!",
    },
  });

  return { outcome, frames };
}

// ── Game Controller ────────────────────────────────────────

export class GameController {
  state: GameState;
  phase: GamePhase;
  p1Submission: PlanningSubmission | null = null;
  lastTurnLog: TurnLogEntry | null = null;
  message: string = "Player 1: Choose a card and spawn minions.";
  laneId = LaneId.Mid;
  battleFrames: BattleFrame[] = [];
  private pendingTurnMessage: string = "";

  constructor() {
    resetIdCounter();
    this.state = createGameState(IRONCLAD, PYROX, ALL_PLANNING_CARDS, [LaneId.Mid]);
    preparePlanningPhase(this.state);
    this.phase = "P1_PLANNING";
  }

  restart(): void {
    resetIdCounter();
    this.state = createGameState(IRONCLAD, PYROX, ALL_PLANNING_CARDS, [LaneId.Mid]);
    preparePlanningPhase(this.state);
    this.phase = "P1_PLANNING";
    this.p1Submission = null;
    this.lastTurnLog = null;
    this.message = "Player 1: Choose a card and spawn minions.";
    this.battleFrames = [];
  }

  getPlayerHand(playerId: PlayerId): PlanningCard[] {
    const idx = playerId === "PLAYER_1" ? 0 : 1;
    return this.state.players[idx].hand;
  }

  getMaxSpawns(playerId: PlayerId): number {
    const idx = playerId === "PLAYER_1" ? 0 : 1;
    const gold = this.state.players[idx].gold;
    return Math.min(MAX_MINIONS_PER_SPAWN, Math.floor(gold / MINION_SPAWN_COST));
  }

  isChampionAlive(playerId: PlayerId): boolean {
    const idx = playerId === "PLAYER_1" ? 0 : 1;
    const champ = this.state.players[idx].champions[0];
    return champ?.isAlive ?? false;
  }

  submitPlanning(playerId: PlayerId, cardId: string, spawnCount: number): boolean {
    const idx = playerId === "PLAYER_1" ? 0 : 1;
    const player = this.state.players[idx];
    const champ = player.champions[0];

    if (!champ || !champ.isAlive) {
      if (playerId === "PLAYER_1") {
        this.p1Submission = createEmptySubmission("PLAYER_1");
        this.phase = "P2_PLANNING";
        this.message = "Player 2: Choose a card and spawn minions.";
      } else {
        this.resolveTurn(createEmptySubmission("PLAYER_2"));
      }
      return true;
    }

    const input: PlanningInput = {
      laneId: this.laneId,
      cardId,
      championId: champ.championId,
      minionSpawnCount: spawnCount,
    };

    const submission = applyPlanningInput(input, player);

    if (playerId === "PLAYER_1") {
      this.p1Submission = submission;
      this.phase = "P2_PLANNING";
      this.message = "Player 2: Choose a card and spawn minions.";
    } else {
      this.resolveTurn(submission);
    }

    return true;
  }

  skipPlanning(playerId: PlayerId): void {
    if (playerId === "PLAYER_1") {
      this.p1Submission = createEmptySubmission("PLAYER_1");
      this.phase = "P2_PLANNING";
      this.message = "Player 2: Choose a card and spawn minions.";
    } else {
      this.resolveTurn(createEmptySubmission("PLAYER_2"));
    }
  }

  private resolveTurn(p2Submission: PlanningSubmission): void {
    this.phase = "RESOLVING";
    const p1Sub = this.p1Submission ?? createEmptySubmission("PLAYER_1");
    this.battleFrames = [];

    // Use a recording battle runner that captures frames
    let recordedFrames: BattleFrame[] = [];
    const recordingRunner: BattleRunner = (
      lId, ln, p1C, p2C, p1S, p2S, ap
    ) => {
      const result = runBattleRecorded(lId, ln, p1C, p2C, p1S, p2S, ap);
      recordedFrames = result.frames;
      return result.outcome;
    };

    executeTurn(this.state, p1Sub, p2Submission, battleAI, recordingRunner);

    this.lastTurnLog = this.state.turnLog[this.state.turnLog.length - 1];

    // Build message from results
    const res = this.lastTurnLog.resolutionResults[0];
    let msg = `Turn ${this.state.turnNumber - 1} complete. `;
    msg += `Minions: P1 ${res.minionCombatLog.player1MinionsStart}->${res.minionCombatLog.player1MinionsEnd}`;
    msg += ` | P2 ${res.minionCombatLog.player2MinionsStart}->${res.minionCombatLog.player2MinionsEnd}. `;
    msg += `Frontline: ${res.frontlineBefore} -> ${res.frontlineAfter}. `;

    if (res.battleTriggered && this.lastTurnLog.battleResults.length > 0) {
      const battle = this.lastTurnLog.battleResults[0];
      msg += `BATTLE! Winner: ${battle.winner ?? "DRAW"}. `;
      if (battle.championDeaths.length > 0) {
        msg += `Champion killed: ${battle.championDeaths.join(", ")}. `;
      }
    }

    // Check if battle occurred and we have frames to show
    if (recordedFrames.length > 0) {
      this.battleFrames = recordedFrames;
      this.pendingTurnMessage = msg;
      this.phase = "BATTLE_REPLAY";
      this.message = "Battle in progress!";
      return;
    }

    if (this.state.result !== GameResult.InProgress) {
      this.phase = "GAME_OVER";
      this.message = `GAME OVER: ${this.state.result}`;
    } else {
      preparePlanningPhase(this.state);
      this.p1Submission = null;
      this.phase = "P1_PLANNING";
      this.message = msg + " Player 1: Choose a card.";
    }
  }

  /** Called by the UI after battle replay finishes */
  finishBattle(): void {
    this.battleFrames = [];

    if (this.state.result !== GameResult.InProgress) {
      this.phase = "GAME_OVER";
      this.message = `GAME OVER: ${this.state.result}`;
    } else {
      preparePlanningPhase(this.state);
      this.p1Submission = null;
      this.phase = "P1_PLANNING";
      this.message = this.pendingTurnMessage + " Player 1: Choose a card.";
    }
  }

  getUIState(): UIState {
    return {
      gameState: this.state,
      phase: this.phase,
      p1Submission: this.p1Submission,
      lastTurnLog: this.lastTurnLog,
      message: this.message,
      battleFrames: this.battleFrames,
    };
  }
}
