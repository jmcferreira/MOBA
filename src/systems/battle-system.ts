import {
  PlayerId,
  LaneId,
  LaneStance,
  StatusEffectType,
  ActionType,
} from "../types/enums.js";
import { LaneState } from "../types/lane.js";
import { Champion } from "../types/champion.js";
import { BattleMinion } from "../types/minion.js";
import { BattleState, BattleOutcome, BattleChampion } from "../types/battle.js";
import { BattleAction } from "../types/actions.js";
import { HexCoord } from "../types/hex.js";
import { createHexGrid, getCell, hexKey } from "../battle/hex-grid.js";
import { buildTurnOrder } from "../battle/turn-order.js";
import {
  findUnitById,
  isUnitAlive,
  executeMove,
  executeBasicAttack,
  executeAbility,
  executeWait,
  executeDefend,
} from "../battle/action-executor.js";
import { executeMinionTurn } from "../battle/minion-ai.js";
import { generateId } from "../utils/id-generator.js";
import {
  BATTLE_GRID_WIDTH,
  BATTLE_GRID_HEIGHT,
  BATTLE_ROUND_LIMIT,
  ENERGY_PER_ROUND,
  MAX_ENERGY,
  MAX_BATTLE_MINIONS_PER_SIDE,
  CHAMPION_KILL_GOLD,
  MINION_KILL_GOLD,
  MINION_BASE_HP,
  MINION_BASE_ATTACK,
} from "../types/constants.js";

// ── Battle Setup ────────────────────────────────────────────

export function setupBattle(
  laneId: LaneId,
  lane: LaneState,
  p1Champion: Champion,
  p2Champion: Champion,
  p1Stance: LaneStance,
  p2Stance: LaneStance
): BattleState {
  const grid = createHexGrid(BATTLE_GRID_WIDTH, BATTLE_GRID_HEIGHT);

  // Place champions
  const p1Start = getStartPosition("PLAYER_1", p1Stance);
  const p2Start = getStartPosition("PLAYER_2", p2Stance);

  p1Champion.battlePosition = p1Start;
  p2Champion.battlePosition = p2Start;
  getCell(grid, p1Start)!.occupantId = p1Champion.championId;
  getCell(grid, p2Start)!.occupantId = p2Champion.championId;

  // Recover energy
  p1Champion.currentEnergy = Math.min(p1Champion.currentEnergy + ENERGY_PER_ROUND, MAX_ENERGY);
  p2Champion.currentEnergy = Math.min(p2Champion.currentEnergy + ENERGY_PER_ROUND, MAX_ENERGY);

  // Create battle minions from lane state
  const frontZone = lane.zones[lane.frontlinePosition];
  const p1MinionCount = Math.min(frontZone.minions.player1.count, MAX_BATTLE_MINIONS_PER_SIDE);
  const p2MinionCount = Math.min(frontZone.minions.player2.count, MAX_BATTLE_MINIONS_PER_SIDE);

  const p1Minions = createBattleMinions("PLAYER_1", p1MinionCount, grid);
  const p2Minions = createBattleMinions("PLAYER_2", p2MinionCount, grid);
  const allMinions = [...p1Minions, ...p2Minions];

  // Build turn order
  const turnOrder = buildTurnOrder(
    p1Champion,
    p2Champion,
    p1Stance,
    p2Stance,
    p1Minions,
    p2Minions
  );

  return {
    laneId,
    roundNumber: 1,
    grid,
    turnOrder,
    currentTurnIndex: 0,
    champions: [
      { championRef: p1Champion, position: p1Start, hasActed: false },
      { championRef: p2Champion, position: p2Start, hasActed: false },
    ],
    minions: allMinions,
    isComplete: false,
    outcome: null,
  };
}

function getStartPosition(playerId: PlayerId, stance: LaneStance): HexCoord {
  if (playerId === "PLAYER_1") {
    switch (stance) {
      case LaneStance.Aggro:
        return { q: 2, r: 2 };
      case LaneStance.Defend:
        return { q: 0, r: 2 };
      case LaneStance.Neutral:
        return { q: 1, r: 2 };
      case LaneStance.Ambush:
        return { q: 2, r: 0 };
    }
  } else {
    switch (stance) {
      case LaneStance.Aggro:
        return { q: 4, r: 2 };
      case LaneStance.Defend:
        return { q: 6, r: 2 };
      case LaneStance.Neutral:
        return { q: 5, r: 2 };
      case LaneStance.Ambush:
        return { q: 4, r: 4 };
    }
  }
}

function createBattleMinions(
  ownerId: PlayerId,
  count: number,
  grid: ReturnType<typeof createHexGrid>
): BattleMinion[] {
  const minions: BattleMinion[] = [];
  const positions =
    ownerId === "PLAYER_1"
      ? [
          { q: 1, r: 1 },
          { q: 1, r: 3 },
          { q: 2, r: 1 },
        ]
      : [
          { q: 5, r: 1 },
          { q: 5, r: 3 },
          { q: 4, r: 3 },
        ];

  for (let i = 0; i < count && i < positions.length; i++) {
    const id = generateId("MINION");
    const pos = positions[i];
    minions.push({
      minionId: id,
      templateId: "STANDARD_MINION",
      ownerId,
      hp: MINION_BASE_HP,
      maxHp: MINION_BASE_HP,
      attack: MINION_BASE_ATTACK,
      position: pos,
      isAlive: true,
    });
    const cell = getCell(grid, pos);
    if (cell) cell.occupantId = id;
  }

  return minions;
}

// ── Battle Round Execution ──────────────────────────────────

export type ActionProvider = (
  unitId: string,
  battle: BattleState
) => BattleAction;

export function executeBattleRound(
  battle: BattleState,
  actionProvider: ActionProvider
): void {
  // Reset hasActed flags
  for (const bc of battle.champions) bc.hasActed = false;

  for (let i = 0; i < battle.turnOrder.length; i++) {
    if (battle.isComplete) break;

    const unitId = battle.turnOrder[i];
    battle.currentTurnIndex = i;

    const unit = findUnitById(battle, unitId);
    if (!unit || !isUnitAlive(unit)) continue;

    if (unit.kind === "champion") {
      // Check if stunned
      const isStunned = unit.ref.statusEffects.some(
        (e) => e.type === StatusEffectType.Stun && e.remainingDuration > 0
      );
      if (!isStunned) {
        const action = actionProvider(unitId, battle);
        executeChampionAction(action, unit.ref, battle);
      }
      const bc = battle.champions.find((c) => c.championRef.championId === unitId);
      if (bc) bc.hasActed = true;
    } else {
      // Minion auto-acts
      executeMinionTurn(unit.ref, battle);
    }

    // Remove dead units from grid
    removeDeadFromGrid(battle);

    // Check battle end
    if (checkBattleEnd(battle)) {
      battle.isComplete = true;
    }
  }

  // End-of-round: tick cooldowns, recover energy, tick status effects
  if (!battle.isComplete) {
    for (const bc of battle.champions) {
      const champ = bc.championRef;
      if (champ.isAlive) {
        champ.currentEnergy = Math.min(champ.currentEnergy + ENERGY_PER_ROUND, MAX_ENERGY);
        for (const ability of champ.abilities) {
          if (ability.cooldownRemaining > 0) ability.cooldownRemaining -= 1;
        }
        champ.statusEffects = champ.statusEffects
          .map((e) => ({ ...e, remainingDuration: e.remainingDuration - 1 }))
          .filter((e) => e.remainingDuration > 0);
      }
    }
  }

  battle.roundNumber += 1;

  if (battle.roundNumber > BATTLE_ROUND_LIMIT && !battle.isComplete) {
    battle.isComplete = true;
  }
}

function executeChampionAction(
  action: BattleAction,
  champion: Champion,
  battle: BattleState
): void {
  switch (action.actionType) {
    case ActionType.Move:
      if (action.targetHex) {
        executeMove({ kind: "champion", ref: champion }, action.targetHex, battle, champion.moveSpeed);
      }
      break;

    case ActionType.Attack:
      if (action.targetId) {
        const target = findUnitById(battle, action.targetId);
        if (target && isUnitAlive(target)) {
          executeBasicAttack({ kind: "champion", ref: champion }, target, battle);
        }
      }
      break;

    case ActionType.Ability:
      if (action.abilityId) {
        const ability = champion.abilities.find((a) => a.abilityId === action.abilityId);
        if (ability) {
          executeAbility(champion, ability, action.targetId, action.targetHex, battle);
        }
      }
      break;

    case ActionType.Defend:
      executeDefend(champion);
      break;

    case ActionType.Wait:
      executeWait(champion);
      break;
  }
}

function removeDeadFromGrid(battle: BattleState): void {
  for (const bc of battle.champions) {
    if (!bc.championRef.isAlive && bc.championRef.battlePosition) {
      const cell = getCell(battle.grid, bc.championRef.battlePosition);
      if (cell && cell.occupantId === bc.championRef.championId) {
        cell.occupantId = null;
      }
    }
  }
  for (const m of battle.minions) {
    if (!m.isAlive) {
      const cell = getCell(battle.grid, m.position);
      if (cell && cell.occupantId === m.minionId) {
        cell.occupantId = null;
      }
    }
  }
}

// ── Battle End Conditions ───────────────────────────────────

function checkBattleEnd(battle: BattleState): boolean {
  const p1Alive = battle.champions.some(
    (c) => c.championRef.ownerId === "PLAYER_1" && c.championRef.isAlive
  );
  const p2Alive = battle.champions.some(
    (c) => c.championRef.ownerId === "PLAYER_2" && c.championRef.isAlive
  );

  if (!p1Alive || !p2Alive) return true;
  return false;
}

// ── Battle Outcome ──────────────────────────────────────────

export function calculateBattleOutcome(battle: BattleState): BattleOutcome {
  let p1Score = 0;
  let p2Score = 0;

  const p1Champ = battle.champions.find((c) => c.championRef.ownerId === "PLAYER_1")!.championRef;
  const p2Champ = battle.champions.find((c) => c.championRef.ownerId === "PLAYER_2")!.championRef;

  // Champion kill = 10 points
  if (!p1Champ.isAlive) p2Score += 10;
  if (!p2Champ.isAlive) p1Score += 10;

  // Surviving minions = 2 points each
  const p1Minions = battle.minions.filter((m) => m.ownerId === "PLAYER_1" && m.isAlive).length;
  const p2Minions = battle.minions.filter((m) => m.ownerId === "PLAYER_2" && m.isAlive).length;
  p1Score += p1Minions * 2;
  p2Score += p2Minions * 2;

  // HP percentage = up to 5 points
  if (p1Champ.isAlive) p1Score += Math.floor((p1Champ.currentHp / p1Champ.maxHp) * 5);
  if (p2Champ.isAlive) p2Score += Math.floor((p2Champ.currentHp / p2Champ.maxHp) * 5);

  // Determine winner
  let winner: PlayerId | null = null;
  if (p1Score > p2Score) winner = "PLAYER_1";
  else if (p2Score > p1Score) winner = "PLAYER_2";

  // Lane push bonus
  let lanePushBonus = 0;
  if (winner !== null) {
    const diff = Math.abs(p1Score - p2Score);
    if (diff >= 10) lanePushBonus = 2;
    else if (diff >= 5) lanePushBonus = 1;
  }

  // Gold and XP
  const goldAwarded: Record<PlayerId, number> = { PLAYER_1: 0, PLAYER_2: 0 };
  const xpAwarded: Record<PlayerId, number> = { PLAYER_1: 0, PLAYER_2: 0 };
  const championDeaths: PlayerId[] = [];

  if (!p1Champ.isAlive) {
    goldAwarded.PLAYER_2 += CHAMPION_KILL_GOLD;
    xpAwarded.PLAYER_2 += 3;
    championDeaths.push("PLAYER_1");
  }
  if (!p2Champ.isAlive) {
    goldAwarded.PLAYER_1 += CHAMPION_KILL_GOLD;
    xpAwarded.PLAYER_1 += 3;
    championDeaths.push("PLAYER_2");
  }

  // Minion kill bounties
  const p1DeadMinions = battle.minions.filter(
    (m) => m.ownerId === "PLAYER_1" && !m.isAlive
  ).length;
  const p2DeadMinions = battle.minions.filter(
    (m) => m.ownerId === "PLAYER_2" && !m.isAlive
  ).length;
  goldAwarded.PLAYER_1 += p2DeadMinions * MINION_KILL_GOLD;
  goldAwarded.PLAYER_2 += p1DeadMinions * MINION_KILL_GOLD;

  return {
    winner,
    lanePushBonus,
    goldAwarded,
    xpAwarded,
    championDeaths,
    damageToStructures: winner ? lanePushBonus : 0,
  };
}

// ── Full Battle Runner ──────────────────────────────────────

export function runBattle(
  laneId: LaneId,
  lane: LaneState,
  p1Champion: Champion,
  p2Champion: Champion,
  p1Stance: LaneStance,
  p2Stance: LaneStance,
  actionProvider: ActionProvider
): BattleOutcome {
  const battle = setupBattle(laneId, lane, p1Champion, p2Champion, p1Stance, p2Stance);

  while (!battle.isComplete && battle.roundNumber <= BATTLE_ROUND_LIMIT) {
    executeBattleRound(battle, actionProvider);
  }

  const outcome = calculateBattleOutcome(battle);
  battle.outcome = outcome;
  return outcome;
}
