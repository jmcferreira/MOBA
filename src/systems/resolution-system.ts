import {
  LaneId,
  LaneStance,
  PlayerId,
  PlanningEffectType,
} from "../types/enums.js";
import { LaneState } from "../types/lane.js";
import { Champion } from "../types/champion.js";
import { PlanningCard } from "../types/card.js";
import { PlanningSubmission, LaneAssignment, MinionSpawnOrder } from "../types/planning.js";
import { MinionCombatLog, ResolutionResult } from "../types/log.js";
import { sumCardEffects } from "./card-system.js";
import { clamp, sign } from "../utils/math.js";
import {
  LANE_ZONE_COUNT,
  MINION_BASE_HP,
  MINION_BASE_ATTACK,
  FREE_MINIONS_PER_LANE,
  PASSIVE_GOLD_PER_TURN,
  MINION_KILL_GOLD,
} from "../types/constants.js";

// ── Public API ──────────────────────────────────────────────

export interface ResolvedLane {
  result: ResolutionResult;
  battleTriggered: boolean;
  goldAwarded: { player1: number; player2: number };
}

export function resolveLane(
  lane: LaneState,
  p1Card: PlanningCard | null,
  p2Card: PlanningCard | null,
  p1Champion: Champion | null,
  p2Champion: Champion | null,
  p1SpawnCount: number,
  p2SpawnCount: number
): ResolvedLane {
  const frontlineBefore = lane.frontlinePosition;

  // Step 1: Spawn minions
  spawnMinions(lane, p1Card, p2Card, p1SpawnCount, p2SpawnCount);

  // Step 2: Position champions
  const p1Stance = p1Card?.stance ?? null;
  const p2Stance = p2Card?.stance ?? null;
  let p1ChampZone: number | null = null;
  let p2ChampZone: number | null = null;

  if (p1Champion && p1Champion.isAlive && p1Stance !== null) {
    p1ChampZone = calculateChampionZone(lane, "PLAYER_1", p1Stance);
    p1Champion.currentZone = p1ChampZone;
    lane.zones[p1ChampZone].championsPresent.push("PLAYER_1");
  }
  if (p2Champion && p2Champion.isAlive && p2Stance !== null) {
    p2ChampZone = calculateChampionZone(lane, "PLAYER_2", p2Stance);
    p2Champion.currentZone = p2ChampZone;
    lane.zones[p2ChampZone].championsPresent.push("PLAYER_2");
  }

  // Step 3: Minion combat at frontline
  const minionCombatLog = resolveMinionCombat(lane, p1Card, p2Card);

  // Step 4: Frontline push
  const pushDelta = calculatePush(minionCombatLog, p1Stance, p2Stance);
  const prevFrontline = lane.frontlinePosition;
  lane.frontlinePosition = clamp(
    lane.frontlinePosition + pushDelta,
    0,
    LANE_ZONE_COUNT - 1
  );

  // Step 5: Structure damage
  const towerDamage = applyStructureDamage(lane, minionCombatLog, p1Card, p2Card);

  // Step 6: Battle trigger
  const battleTriggered = checkBattleTrigger(
    p1Stance,
    p2Stance,
    p1ChampZone,
    p2ChampZone
  );

  // Step 7: Gold awards
  const goldAwarded = calculateGoldAwards(minionCombatLog, p1Card, p2Card);

  return {
    result: {
      laneId: lane.laneId,
      minionCombatLog,
      frontlineBefore,
      frontlineAfter: lane.frontlinePosition,
      battleTriggered,
      towerDamage: {
        PLAYER_1: towerDamage.player1,
        PLAYER_2: towerDamage.player2,
      },
    },
    battleTriggered,
    goldAwarded,
  };
}

// ── Step 1: Spawn Minions ───────────────────────────────────

function spawnMinions(
  lane: LaneState,
  p1Card: PlanningCard | null,
  p2Card: PlanningCard | null,
  p1Purchased: number,
  p2Purchased: number
): void {
  const p1Bonus = sumCardEffects(p1Card, PlanningEffectType.BonusMinions);
  const p2Bonus = sumCardEffects(p2Card, PlanningEffectType.BonusMinions);

  const p1Total = FREE_MINIONS_PER_LANE + p1Purchased + p1Bonus;
  const p2Total = FREE_MINIONS_PER_LANE + p2Purchased + p2Bonus;

  const frontZone = lane.zones[lane.frontlinePosition];
  frontZone.minions.player1.count += p1Total;
  frontZone.minions.player1.totalHp += p1Total * MINION_BASE_HP;
  frontZone.minions.player2.count += p2Total;
  frontZone.minions.player2.totalHp += p2Total * MINION_BASE_HP;
}

// ── Step 2: Champion Positioning ────────────────────────────

export function calculateChampionZone(
  lane: LaneState,
  playerId: PlayerId,
  stance: LaneStance
): number {
  const front = lane.frontlinePosition;

  if (playerId === "PLAYER_1") {
    // P1 pushes toward higher zone numbers (toward P2 base at zone 6)
    switch (stance) {
      case LaneStance.Aggro:
        return Math.min(front + 1, LANE_ZONE_COUNT - 1);
      case LaneStance.Defend:
        return Math.max(front - 2, 1); // At least tower zone
      case LaneStance.Neutral:
        return front;
      case LaneStance.Ambush:
        return front; // Same zone, but hidden flag affects battle
    }
  } else {
    // P2 pushes toward lower zone numbers (toward P1 base at zone 0)
    switch (stance) {
      case LaneStance.Aggro:
        return Math.max(front - 1, 0);
      case LaneStance.Defend:
        return Math.min(front + 2, LANE_ZONE_COUNT - 2); // At least own tower zone
      case LaneStance.Neutral:
        return front;
      case LaneStance.Ambush:
        return front;
    }
  }
}

// ── Step 3: Minion Combat ───────────────────────────────────

function resolveMinionCombat(
  lane: LaneState,
  p1Card: PlanningCard | null,
  p2Card: PlanningCard | null
): MinionCombatLog {
  const frontZone = lane.zones[lane.frontlinePosition];
  const p1Count = frontZone.minions.player1.count;
  const p2Count = frontZone.minions.player2.count;

  const p1Attack =
    MINION_BASE_ATTACK + sumCardEffects(p1Card, PlanningEffectType.MinionDamageBoost);
  const p2Attack =
    MINION_BASE_ATTACK + sumCardEffects(p2Card, PlanningEffectType.MinionDamageBoost);
  const p1MinionHp =
    MINION_BASE_HP + sumCardEffects(p1Card, PlanningEffectType.FortifyMinions);
  const p2MinionHp =
    MINION_BASE_HP + sumCardEffects(p2Card, PlanningEffectType.FortifyMinions);

  // Simultaneous exchange
  const p1TotalDamage = p1Count * p1Attack; // damage dealt TO p2 minions
  const p2TotalDamage = p2Count * p2Attack; // damage dealt TO p1 minions

  const p1RemainingHp = Math.max(0, p1Count * p1MinionHp - p2TotalDamage);
  const p2RemainingHp = Math.max(0, p2Count * p2MinionHp - p1TotalDamage);

  const p1Surviving = p1RemainingHp > 0 ? Math.ceil(p1RemainingHp / p1MinionHp) : 0;
  const p2Surviving = p2RemainingHp > 0 ? Math.ceil(p2RemainingHp / p2MinionHp) : 0;

  // Update zone state
  frontZone.minions.player1.count = p1Surviving;
  frontZone.minions.player1.totalHp = p1RemainingHp;
  frontZone.minions.player2.count = p2Surviving;
  frontZone.minions.player2.totalHp = p2RemainingHp;

  return {
    player1MinionsStart: p1Count,
    player2MinionsStart: p2Count,
    player1MinionsEnd: p1Surviving,
    player2MinionsEnd: p2Surviving,
    player1Casualties: p1Count - p1Surviving,
    player2Casualties: p2Count - p2Surviving,
  };
}

// ── Step 4: Frontline Push ──────────────────────────────────

function calculatePush(
  combat: MinionCombatLog,
  p1Stance: LaneStance | null,
  p2Stance: LaneStance | null
): number {
  let basePush = 0;

  if (combat.player1MinionsEnd > 0 && combat.player2MinionsEnd === 0) {
    basePush = 1; // P1 pushes toward P2
  } else if (combat.player2MinionsEnd > 0 && combat.player1MinionsEnd === 0) {
    basePush = -1; // P2 pushes toward P1
  }

  // Stance modifier: Aggro adds push only if you have surviving minions
  let stancePush = 0;
  if (p1Stance === LaneStance.Aggro && combat.player1MinionsEnd >= combat.player2MinionsEnd) {
    stancePush += 1;
  }
  if (p2Stance === LaneStance.Aggro && combat.player2MinionsEnd >= combat.player1MinionsEnd) {
    stancePush -= 1;
  }

  const totalPush = clamp(basePush + sign(stancePush), -2, 2);
  return totalPush;
}

// ── Step 5: Structure Damage ────────────────────────────────

function applyStructureDamage(
  lane: LaneState,
  combat: MinionCombatLog,
  p1Card: PlanningCard | null,
  p2Card: PlanningCard | null
): { player1: number; player2: number } {
  const towerDamage = { player1: 0, player2: 0 };

  const p1TowerReduction = sumCardEffects(p2Card, PlanningEffectType.TowerDamageReduction);
  const p2TowerReduction = sumCardEffects(p1Card, PlanningEffectType.TowerDamageReduction);

  // P1 minions reaching P2's tower (zone 5) or base (zone 6)
  if (lane.frontlinePosition >= 5 && combat.player1MinionsEnd > 0) {
    const rawDamage = combat.player1MinionsEnd;
    const reducedDamage = Math.max(0, rawDamage - p1TowerReduction);

    if (lane.towerHp.player2 > 0) {
      const dmg = Math.min(reducedDamage, lane.towerHp.player2);
      lane.towerHp.player2 -= dmg;
      towerDamage.player2 += dmg;
      // Overflow to base if tower destroyed
      if (lane.towerHp.player2 <= 0 && lane.frontlinePosition >= 6) {
        const overflow = reducedDamage - dmg;
        lane.baseHp.player2 -= overflow;
        towerDamage.player2 += overflow;
      }
    } else if (lane.frontlinePosition >= 6) {
      // Tower already destroyed, damage base directly
      lane.baseHp.player2 -= reducedDamage;
      towerDamage.player2 += reducedDamage;
    }
  }

  // P2 minions reaching P1's tower (zone 1) or base (zone 0)
  if (lane.frontlinePosition <= 1 && combat.player2MinionsEnd > 0) {
    const rawDamage = combat.player2MinionsEnd;
    const reducedDamage = Math.max(0, rawDamage - p2TowerReduction);

    if (lane.towerHp.player1 > 0) {
      const dmg = Math.min(reducedDamage, lane.towerHp.player1);
      lane.towerHp.player1 -= dmg;
      towerDamage.player1 += dmg;
      if (lane.towerHp.player1 <= 0 && lane.frontlinePosition <= 0) {
        const overflow = reducedDamage - dmg;
        lane.baseHp.player1 -= overflow;
        towerDamage.player1 += overflow;
      }
    } else if (lane.frontlinePosition <= 0) {
      lane.baseHp.player1 -= reducedDamage;
      towerDamage.player1 += reducedDamage;
    }
  }

  return towerDamage;
}

// ── Step 6: Battle Trigger ──────────────────────────────────

export function checkBattleTrigger(
  p1Stance: LaneStance | null,
  p2Stance: LaneStance | null,
  p1ChampZone: number | null,
  p2ChampZone: number | null
): boolean {
  // No battle if either champion is absent
  if (p1ChampZone === null || p2ChampZone === null) return false;
  if (p1Stance === null || p2Stance === null) return false;

  // Both defending = no battle
  if (p1Stance === LaneStance.Defend && p2Stance === LaneStance.Defend) return false;

  const championsClose = Math.abs(p1ChampZone - p2ChampZone) <= 1;
  const aggressivePresent =
    p1Stance === LaneStance.Aggro ||
    p2Stance === LaneStance.Aggro ||
    p1Stance === LaneStance.Ambush ||
    p2Stance === LaneStance.Ambush;

  if (championsClose && aggressivePresent) return true;

  // Ambush forces battle if zones match
  if (p1Stance === LaneStance.Ambush && p1ChampZone === p2ChampZone) return true;
  if (p2Stance === LaneStance.Ambush && p2ChampZone === p1ChampZone) return true;

  return false;
}

// ── Step 7: Gold Awards ─────────────────────────────────────

function calculateGoldAwards(
  combat: MinionCombatLog,
  p1Card: PlanningCard | null,
  p2Card: PlanningCard | null
): { player1: number; player2: number } {
  const p1Gold =
    PASSIVE_GOLD_PER_TURN +
    combat.player2Casualties * MINION_KILL_GOLD +
    sumCardEffects(p1Card, PlanningEffectType.BonusGold);

  const p2Gold =
    PASSIVE_GOLD_PER_TURN +
    combat.player1Casualties * MINION_KILL_GOLD +
    sumCardEffects(p2Card, PlanningEffectType.BonusGold);

  return { player1: p1Gold, player2: p2Gold };
}

// ── Helpers for external use ────────────────────────────────

export function getLaneAssignment(
  submission: PlanningSubmission,
  laneId: LaneId
): LaneAssignment | undefined {
  return submission.laneAssignments.find((a) => a.laneId === laneId);
}

export function getSpawnOrder(
  submission: PlanningSubmission,
  laneId: LaneId
): MinionSpawnOrder | undefined {
  return submission.minionSpawnOrders.find((o) => o.laneId === laneId);
}
