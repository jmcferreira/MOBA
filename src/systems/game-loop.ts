import {
  Phase,
  GameResult,
  LaneId,
  PlayerId,
  LaneStance,
} from "../types/enums.js";
import { GameState, PlayerState } from "../types/game-state.js";
import { LaneState } from "../types/lane.js";
import { Champion } from "../types/champion.js";
import { ChampionDefinition } from "../types/champion.js";
import { PlanningCard } from "../types/card.js";
import { PlanningSubmission } from "../types/planning.js";
import { TurnLogEntry, ResolutionResult } from "../types/log.js";
import { BattleOutcome } from "../types/battle.js";
import { createLaneState } from "./lane-system.js";
import { createPlayerDeck } from "./card-system.js";
import {
  createChampionFromDefinition,
  tickRespawn,
  tickCooldowns,
  resetChampionLaneState,
  killChampion,
  checkLevelUp,
} from "./champion-system.js";
import {
  resolveLane,
  getLaneAssignment,
  getSpawnOrder,
} from "./resolution-system.js";
import { runBattle, ActionProvider } from "./battle-system.js";
import { clamp } from "../utils/math.js";
import {
  MAX_TURNS,
  STARTING_GOLD,
  LANE_ZONE_COUNT,
} from "../types/constants.js";

// ── Game Initialization ─────────────────────────────────────

export function createGameState(
  p1ChampionDef: ChampionDefinition,
  p2ChampionDef: ChampionDefinition,
  cardPool: PlanningCard[],
  laneIds: LaneId[] = [LaneId.Mid]
): GameState {
  const p1Deck = createPlayerDeck(cardPool);
  const p2Deck = createPlayerDeck(cardPool);

  const players: [PlayerState, PlayerState] = [
    {
      playerId: "PLAYER_1",
      gold: STARTING_GOLD,
      champions: [createChampionFromDefinition(p1ChampionDef, "PLAYER_1")],
      hand: p1Deck.hand,
      deck: p1Deck.deck,
      discard: p1Deck.discard,
    },
    {
      playerId: "PLAYER_2",
      gold: STARTING_GOLD,
      champions: [createChampionFromDefinition(p2ChampionDef, "PLAYER_2")],
      hand: p2Deck.hand,
      deck: p2Deck.deck,
      discard: p2Deck.discard,
    },
  ];

  const lanes: Record<string, LaneState> = {};
  for (const id of laneIds) {
    lanes[id] = createLaneState(id);
  }

  return {
    turnNumber: 1,
    phase: Phase.Planning,
    result: GameResult.InProgress,
    players,
    lanes: lanes as Record<LaneId, LaneState>,
    activeBattles: [],
    turnLog: [],
  };
}

// ── Turn Execution ──────────────────────────────────────────

export function executeTurn(
  gameState: GameState,
  p1Submission: PlanningSubmission,
  p2Submission: PlanningSubmission,
  battleActionProvider: ActionProvider
): void {
  // Step 0: Start-of-turn maintenance
  startOfTurnMaintenance(gameState);

  // Step 1: Resolution phase
  gameState.phase = Phase.Resolution;
  const resolutionResults: ResolutionResult[] = [];
  const battleTriggers: {
    laneId: LaneId;
    p1Stance: LaneStance;
    p2Stance: LaneStance;
  }[] = [];
  let totalGoldP1 = 0;
  let totalGoldP2 = 0;

  for (const laneId of Object.keys(gameState.lanes) as LaneId[]) {
    const lane = gameState.lanes[laneId];

    const p1Assignment = getLaneAssignment(p1Submission, laneId);
    const p2Assignment = getLaneAssignment(p2Submission, laneId);

    const p1Card = p1Assignment
      ? findCardInDiscard(gameState.players[0], p1Assignment.cardId)
      : null;
    const p2Card = p2Assignment
      ? findCardInDiscard(gameState.players[1], p2Assignment.cardId)
      : null;

    const p1Champion = p1Assignment?.championId
      ? findChampion(gameState.players[0], p1Assignment.championId)
      : null;
    const p2Champion = p2Assignment?.championId
      ? findChampion(gameState.players[1], p2Assignment.championId)
      : null;

    const p1SpawnCount = getSpawnOrder(p1Submission, laneId)?.count ?? 0;
    const p2SpawnCount = getSpawnOrder(p2Submission, laneId)?.count ?? 0;

    const resolved = resolveLane(
      lane,
      p1Card,
      p2Card,
      p1Champion,
      p2Champion,
      p1SpawnCount,
      p2SpawnCount
    );

    resolutionResults.push(resolved.result);
    totalGoldP1 += resolved.goldAwarded.player1;
    totalGoldP2 += resolved.goldAwarded.player2;

    if (resolved.battleTriggered && p1Champion && p2Champion && p1Card && p2Card) {
      battleTriggers.push({
        laneId,
        p1Stance: p1Card.stance,
        p2Stance: p2Card.stance,
      });
    }
  }

  // Award resolution gold
  gameState.players[0].gold += totalGoldP1;
  gameState.players[1].gold += totalGoldP2;

  // Step 2: Battle phase
  gameState.phase = Phase.Battle;
  const battleResults: BattleOutcome[] = [];

  for (const trigger of battleTriggers) {
    const lane = gameState.lanes[trigger.laneId];
    const p1Champion = getActiveLaneChampion(gameState.players[0], trigger.laneId);
    const p2Champion = getActiveLaneChampion(gameState.players[1], trigger.laneId);

    if (!p1Champion || !p2Champion) continue;

    const outcome = runBattle(
      trigger.laneId,
      lane,
      p1Champion,
      p2Champion,
      trigger.p1Stance,
      trigger.p2Stance,
      battleActionProvider
    );

    battleResults.push(outcome);

    // Apply battle outcome to lane
    applyBattleOutcome(outcome, lane, gameState);
  }

  // Step 3: Log the turn
  gameState.turnLog.push({
    turnNumber: gameState.turnNumber,
    planningSubmissions: [p1Submission, p2Submission],
    resolutionResults,
    battleResults,
    goldChanges: {
      PLAYER_1: totalGoldP1,
      PLAYER_2: totalGoldP2,
    },
  });

  // Step 4: Check win condition
  gameState.result = checkWinCondition(gameState);

  // Step 5: Advance turn
  gameState.turnNumber += 1;
  gameState.phase = Phase.Planning;
}

// ── Helpers ─────────────────────────────────────────────────

function startOfTurnMaintenance(gameState: GameState): void {
  for (const player of gameState.players) {
    for (const champion of player.champions) {
      tickRespawn(champion);
      tickCooldowns(champion);
      resetChampionLaneState(champion);
    }
  }

  // Clear champion presence from all lanes
  for (const laneId of Object.keys(gameState.lanes) as LaneId[]) {
    const lane = gameState.lanes[laneId];
    for (const zone of lane.zones) {
      zone.championsPresent = [];
    }
  }
}

function findCardInDiscard(player: PlayerState, cardId: string): PlanningCard | null {
  return player.discard.find((c) => c.cardId === cardId) ?? null;
}

function findChampion(player: PlayerState, championId: string): Champion | null {
  return player.champions.find((c) => c.championId === championId) ?? null;
}

function getActiveLaneChampion(player: PlayerState, laneId: LaneId): Champion | null {
  return player.champions.find(
    (c) => c.assignedLane === laneId && c.isAlive
  ) ?? null;
}

function applyBattleOutcome(
  outcome: BattleOutcome,
  lane: LaneState,
  gameState: GameState
): void {
  // Lane push from battle
  if (outcome.winner === "PLAYER_1") {
    lane.frontlinePosition = clamp(
      lane.frontlinePosition + outcome.lanePushBonus,
      0,
      LANE_ZONE_COUNT - 1
    );
  } else if (outcome.winner === "PLAYER_2") {
    lane.frontlinePosition = clamp(
      lane.frontlinePosition - outcome.lanePushBonus,
      0,
      LANE_ZONE_COUNT - 1
    );
  }

  // Award gold and XP
  for (const pid of ["PLAYER_1", "PLAYER_2"] as PlayerId[]) {
    const player = gameState.players[pid === "PLAYER_1" ? 0 : 1];
    player.gold += outcome.goldAwarded[pid];

    for (const champ of player.champions) {
      champ.xp += outcome.xpAwarded[pid];
      checkLevelUp(champ);
    }
  }

  // Handle champion deaths
  for (const deadOwner of outcome.championDeaths) {
    const player = gameState.players[deadOwner === "PLAYER_1" ? 0 : 1];
    for (const champ of player.champions) {
      if (!champ.isAlive) {
        killChampion(champ);
      }
    }
  }

  // Structure damage from decisive victories
  if (outcome.damageToStructures > 0 && outcome.winner) {
    const loserId = outcome.winner === "PLAYER_1" ? "player2" : "player1";
    if (
      (outcome.winner === "PLAYER_1" && lane.frontlinePosition >= 5) ||
      (outcome.winner === "PLAYER_2" && lane.frontlinePosition <= 1)
    ) {
      if (lane.towerHp[loserId] > 0) {
        lane.towerHp[loserId] = Math.max(
          0,
          lane.towerHp[loserId] - outcome.damageToStructures
        );
      } else {
        lane.baseHp[loserId] = Math.max(
          0,
          lane.baseHp[loserId] - outcome.damageToStructures
        );
      }
    }
  }
}

export function checkWinCondition(gameState: GameState): GameResult {
  for (const laneId of Object.keys(gameState.lanes) as LaneId[]) {
    const lane = gameState.lanes[laneId];
    if (lane.baseHp.player1 <= 0) return GameResult.Player2Wins;
    if (lane.baseHp.player2 <= 0) return GameResult.Player1Wins;
  }

  if (gameState.turnNumber >= MAX_TURNS) {
    let p1TotalHp = 0;
    let p2TotalHp = 0;
    for (const laneId of Object.keys(gameState.lanes) as LaneId[]) {
      const lane = gameState.lanes[laneId];
      p1TotalHp += lane.towerHp.player1 + lane.baseHp.player1;
      p2TotalHp += lane.towerHp.player2 + lane.baseHp.player2;
    }
    if (p1TotalHp > p2TotalHp) return GameResult.Player1Wins;
    if (p2TotalHp > p1TotalHp) return GameResult.Player2Wins;
    return GameResult.Draw;
  }

  return GameResult.InProgress;
}
