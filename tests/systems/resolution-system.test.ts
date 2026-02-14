import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveLane,
  calculateChampionZone,
  checkBattleTrigger,
} from "../../src/systems/resolution-system.js";
import { createLaneState } from "../../src/systems/lane-system.js";
import { createChampionFromDefinition } from "../../src/systems/champion-system.js";
import { LaneId, LaneStance, PlanningEffectType } from "../../src/types/enums.js";
import { LaneState } from "../../src/types/lane.js";
import { Champion } from "../../src/types/champion.js";
import { PlanningCard } from "../../src/types/card.js";
import { IRONCLAD } from "../../src/data/champions/ironclad.js";
import { PYROX } from "../../src/data/champions/pyrox.js";
import {
  ADVANCE,
  RALLY_CHARGE,
  HOLD_THE_LINE,
  FORTIFY,
  STEADY_PUSH,
  FLANK_STRIKE,
  SHADOW_ASSAULT,
} from "../../src/data/cards/planning-cards.js";
import {
  INITIAL_FRONTLINE,
  PASSIVE_GOLD_PER_TURN,
  MINION_KILL_GOLD,
  MINION_BASE_HP,
  FREE_MINIONS_PER_LANE,
} from "../../src/types/constants.js";

describe("calculateChampionZone", () => {
  let lane: LaneState;

  beforeEach(() => {
    lane = createLaneState(LaneId.Mid);
  });

  it("P1 Aggro places champion one zone ahead of frontline", () => {
    expect(calculateChampionZone(lane, "PLAYER_1", LaneStance.Aggro)).toBe(
      INITIAL_FRONTLINE + 1
    );
  });

  it("P1 Defend places champion two zones behind frontline (min 1)", () => {
    expect(calculateChampionZone(lane, "PLAYER_1", LaneStance.Defend)).toBe(
      INITIAL_FRONTLINE - 2
    );
  });

  it("P1 Neutral places champion at frontline", () => {
    expect(calculateChampionZone(lane, "PLAYER_1", LaneStance.Neutral)).toBe(
      INITIAL_FRONTLINE
    );
  });

  it("P2 Aggro places champion one zone ahead (lower index)", () => {
    expect(calculateChampionZone(lane, "PLAYER_2", LaneStance.Aggro)).toBe(
      INITIAL_FRONTLINE - 1
    );
  });

  it("P2 Defend places champion two zones behind (higher index)", () => {
    expect(calculateChampionZone(lane, "PLAYER_2", LaneStance.Defend)).toBe(
      INITIAL_FRONTLINE + 2
    );
  });

  it("clamps P1 Aggro at end of lane", () => {
    lane.frontlinePosition = 6;
    expect(calculateChampionZone(lane, "PLAYER_1", LaneStance.Aggro)).toBe(6);
  });

  it("clamps P1 Defend at tower zone (1)", () => {
    lane.frontlinePosition = 1;
    expect(calculateChampionZone(lane, "PLAYER_1", LaneStance.Defend)).toBe(1);
  });
});

describe("checkBattleTrigger", () => {
  it("triggers when both Aggro and champions close", () => {
    expect(checkBattleTrigger(LaneStance.Aggro, LaneStance.Aggro, 3, 4)).toBe(true);
  });

  it("does NOT trigger when both Defend", () => {
    expect(checkBattleTrigger(LaneStance.Defend, LaneStance.Defend, 3, 3)).toBe(false);
  });

  it("triggers when one Aggro and champions adjacent", () => {
    expect(checkBattleTrigger(LaneStance.Aggro, LaneStance.Neutral, 4, 3)).toBe(true);
  });

  it("does NOT trigger when Neutral vs Neutral (no aggression)", () => {
    expect(checkBattleTrigger(LaneStance.Neutral, LaneStance.Neutral, 3, 3)).toBe(false);
  });

  it("triggers on Ambush when zones match", () => {
    expect(checkBattleTrigger(LaneStance.Ambush, LaneStance.Neutral, 3, 3)).toBe(true);
  });

  it("does NOT trigger when champion absent", () => {
    expect(checkBattleTrigger(LaneStance.Aggro, LaneStance.Aggro, null, 3)).toBe(false);
  });

  it("both Ambush same zone triggers battle", () => {
    expect(checkBattleTrigger(LaneStance.Ambush, LaneStance.Ambush, 3, 3)).toBe(true);
  });

  it("does NOT trigger when champions far apart even with Aggro", () => {
    expect(checkBattleTrigger(LaneStance.Aggro, LaneStance.Defend, 4, 1)).toBe(false);
  });
});

describe("resolveLane", () => {
  let lane: LaneState;
  let p1Champ: Champion;
  let p2Champ: Champion;

  beforeEach(() => {
    lane = createLaneState(LaneId.Mid);
    p1Champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    p2Champ = createChampionFromDefinition(PYROX, "PLAYER_2");
  });

  it("spawns free minions even with no purchases and null cards", () => {
    const result = resolveLane(lane, null, null, null, null, 0, 0);
    // Free wave: 1 each. They fight: 1*1 dmg vs 2 HP = both survive with 1 HP each.
    expect(result.result.minionCombatLog.player1MinionsStart).toBe(FREE_MINIONS_PER_LANE);
    expect(result.result.minionCombatLog.player2MinionsStart).toBe(FREE_MINIONS_PER_LANE);
    // 1 minion with 1 atk vs 1 minion with 2 hp: 1 damage, both survive
    expect(result.result.minionCombatLog.player1MinionsEnd).toBe(1);
    expect(result.result.minionCombatLog.player2MinionsEnd).toBe(1);
  });

  it("purchased minions are added to the frontline", () => {
    const result = resolveLane(lane, ADVANCE, ADVANCE, p1Champ, p2Champ, 2, 0);
    // P1: 1 free + 2 purchased = 3. P2: 1 free + 0 = 1.
    expect(result.result.minionCombatLog.player1MinionsStart).toBe(3);
    expect(result.result.minionCombatLog.player2MinionsStart).toBe(1);
  });

  it("Rally Charge adds bonus minion", () => {
    const result = resolveLane(lane, RALLY_CHARGE, ADVANCE, p1Champ, p2Champ, 0, 0);
    // P1: 1 free + 0 purchased + 1 bonus = 2. P2: 1 free = 1.
    expect(result.result.minionCombatLog.player1MinionsStart).toBe(2);
  });

  it("Aggro vs Neutral with minion advantage pushes frontline", () => {
    const result = resolveLane(lane, ADVANCE, STEADY_PUSH, p1Champ, p2Champ, 2, 0);
    // P1 has 3 minions, P2 has 1. P1 deals 3 dmg to P2 (kills 1 minion at 2hp).
    // P2 deals 1 dmg to P1 (3 minions survive with 5 hp total).
    // P1 survivors > 0 and P2 survivors == 0 → basePush = +1
    // P1 Aggro + P1 surviving >= P2 surviving → stancePush = +1
    // Total push = clamp(1 + 1, -2, 2) = 2
    expect(result.result.frontlineAfter).toBe(INITIAL_FRONTLINE + 2);
  });

  it("equal forces = no push", () => {
    const result = resolveLane(lane, STEADY_PUSH, STEADY_PUSH, p1Champ, p2Champ, 0, 0);
    expect(result.result.frontlineAfter).toBe(INITIAL_FRONTLINE);
  });

  it("gold awards include passive + kill bounties + card bonuses", () => {
    const result = resolveLane(lane, STEADY_PUSH, ADVANCE, p1Champ, p2Champ, 2, 0);
    // P1 has Steady Push (+1 gold bonus). P1: 3 minions, P2: 1 minion.
    // P1 kills P2 minions, P2 may kill some P1 minions.
    expect(result.goldAwarded.player1).toBeGreaterThanOrEqual(PASSIVE_GOLD_PER_TURN + 1); // +1 from card
  });

  it("Fortify card increases minion HP", () => {
    // Fortify gives +1 HP to P1 minions (3 HP each instead of 2)
    const result = resolveLane(lane, FORTIFY, ADVANCE, p1Champ, p2Champ, 0, 0);
    // P1: 1 minion at 3HP, P2: 1 minion at 2HP
    // P1 deals 1 dmg to P2 (2hp -> 1hp, survives). P2 deals 1 dmg to P1 (3hp -> 2hp, survives).
    expect(result.result.minionCombatLog.player1MinionsEnd).toBe(1);
    expect(result.result.minionCombatLog.player2MinionsEnd).toBe(1);
  });

  it("battle triggers when P1 Aggro and P2 Neutral with champions close", () => {
    // P1 Aggro → zone 4, P2 Neutral → zone 3. Distance = 1. Aggro present. → battle.
    const result = resolveLane(lane, ADVANCE, STEADY_PUSH, p1Champ, p2Champ, 0, 0);
    expect(result.battleTriggered).toBe(true);
  });

  it("no battle when both Neutral", () => {
    const result = resolveLane(lane, STEADY_PUSH, STEADY_PUSH, p1Champ, p2Champ, 0, 0);
    expect(result.battleTriggered).toBe(false);
  });

  it("no battle when no champions assigned", () => {
    const result = resolveLane(lane, ADVANCE, ADVANCE, null, null, 0, 0);
    expect(result.battleTriggered).toBe(false);
  });

  it("Ambush vs Neutral at same zone triggers battle", () => {
    const result = resolveLane(lane, FLANK_STRIKE, STEADY_PUSH, p1Champ, p2Champ, 0, 0);
    // P1 Ambush → zone 3, P2 Neutral → zone 3. Ambush at same zone → battle.
    expect(result.battleTriggered).toBe(true);
  });

  it("both Defend = no battle even at same zone", () => {
    const result = resolveLane(
      lane,
      HOLD_THE_LINE,
      HOLD_THE_LINE,
      p1Champ,
      p2Champ,
      0,
      0
    );
    expect(result.battleTriggered).toBe(false);
  });
});
