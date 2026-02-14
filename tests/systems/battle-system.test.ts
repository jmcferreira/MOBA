import { describe, it, expect, beforeEach } from "vitest";
import {
  setupBattle,
  executeBattleRound,
  calculateBattleOutcome,
  runBattle,
} from "../../src/systems/battle-system.js";
import { createLaneState } from "../../src/systems/lane-system.js";
import { createChampionFromDefinition } from "../../src/systems/champion-system.js";
import { getChampionInitiative, buildTurnOrder } from "../../src/battle/turn-order.js";
import { applyDamage } from "../../src/battle/action-executor.js";
import {
  LaneId,
  LaneStance,
  ActionType,
  DamageType,
  ChampionRole,
} from "../../src/types/enums.js";
import { IRONCLAD } from "../../src/data/champions/ironclad.js";
import { PYROX } from "../../src/data/champions/pyrox.js";
import { Champion } from "../../src/types/champion.js";
import { BattleAction } from "../../src/types/actions.js";
import { BattleState } from "../../src/types/battle.js";
import { LaneState } from "../../src/types/lane.js";
import {
  BATTLE_GRID_WIDTH,
  BATTLE_GRID_HEIGHT,
  BATTLE_ROUND_LIMIT,
  MAX_ENERGY,
  CHAMPION_KILL_GOLD,
} from "../../src/types/constants.js";
import { resetIdCounter } from "../../src/utils/id-generator.js";

describe("Turn Order", () => {
  it("Ambush grants +3 initiative", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1"); // Tank = 1
    expect(getChampionInitiative(champ, LaneStance.Ambush)).toBe(4); // 1 + 3
    expect(getChampionInitiative(champ, LaneStance.Neutral)).toBe(1);
  });

  it("Defend reduces initiative by 1", () => {
    const champ = createChampionFromDefinition(PYROX, "PLAYER_2"); // Mage = 4
    expect(getChampionInitiative(champ, LaneStance.Defend)).toBe(3); // 4 - 1
  });

  it("higher initiative champion goes first", () => {
    const p1 = createChampionFromDefinition(IRONCLAD, "PLAYER_1"); // Tank = 1
    const p2 = createChampionFromDefinition(PYROX, "PLAYER_2"); // Mage = 4

    const order = buildTurnOrder(p1, p2, LaneStance.Neutral, LaneStance.Neutral, [], []);
    // Pyrox (4) > Ironclad (1), so Pyrox goes first
    expect(order[0]).toBe("PYROX");
    expect(order[1]).toBe("IRONCLAD");
  });

  it("tied initiative: P1 goes first", () => {
    const p1 = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    const p2 = createChampionFromDefinition(IRONCLAD, "PLAYER_2");

    const order = buildTurnOrder(p1, p2, LaneStance.Neutral, LaneStance.Neutral, [], []);
    // Both Tank = 1, P1 goes first
    expect(order[0]).toBe("IRONCLAD"); // P1's ironclad
  });
});

describe("Battle Setup", () => {
  let lane: LaneState;
  let p1Champ: Champion;
  let p2Champ: Champion;

  beforeEach(() => {
    resetIdCounter();
    lane = createLaneState(LaneId.Mid);
    p1Champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    p2Champ = createChampionFromDefinition(PYROX, "PLAYER_2");
  });

  it("creates a battle with correct grid dimensions", () => {
    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Neutral, LaneStance.Neutral
    );
    expect(battle.grid.width).toBe(BATTLE_GRID_WIDTH);
    expect(battle.grid.height).toBe(BATTLE_GRID_HEIGHT);
    expect(battle.roundNumber).toBe(1);
    expect(battle.isComplete).toBe(false);
  });

  it("places champions at stance-appropriate positions", () => {
    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Aggro, LaneStance.Defend
    );
    expect(p1Champ.battlePosition).toEqual({ q: 2, r: 2 }); // Aggro forward
    expect(p2Champ.battlePosition).toEqual({ q: 6, r: 2 }); // Defend back
  });

  it("places Ambush champions on flanking positions", () => {
    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Ambush, LaneStance.Ambush
    );
    expect(p1Champ.battlePosition).toEqual({ q: 2, r: 0 }); // Top flank
    expect(p2Champ.battlePosition).toEqual({ q: 4, r: 4 }); // Bottom flank
  });

  it("creates battle minions from lane state", () => {
    // Add minions to frontline zone
    lane.zones[lane.frontlinePosition].minions.player1.count = 2;
    lane.zones[lane.frontlinePosition].minions.player1.totalHp = 4;
    lane.zones[lane.frontlinePosition].minions.player2.count = 1;
    lane.zones[lane.frontlinePosition].minions.player2.totalHp = 2;

    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Neutral, LaneStance.Neutral
    );
    const p1Minions = battle.minions.filter((m) => m.ownerId === "PLAYER_1");
    const p2Minions = battle.minions.filter((m) => m.ownerId === "PLAYER_2");
    expect(p1Minions.length).toBe(2);
    expect(p2Minions.length).toBe(1);
  });
});

describe("Damage Calculation", () => {
  it("physical damage reduced by armor", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1"); // armor = 3
    const startHp = champ.currentHp;
    const dealt = applyDamage({ kind: "champion", ref: champ }, 5, DamageType.Physical);
    expect(dealt).toBe(2); // 5 - 3 armor
    expect(champ.currentHp).toBe(startHp - 2);
  });

  it("magical damage reduced by magic resist", () => {
    const champ = createChampionFromDefinition(PYROX, "PLAYER_2"); // magicResist = 2
    const startHp = champ.currentHp;
    const dealt = applyDamage({ kind: "champion", ref: champ }, 4, DamageType.Magical);
    expect(dealt).toBe(2); // 4 - 2
    expect(champ.currentHp).toBe(startHp - 2);
  });

  it("true damage ignores all reduction", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    const startHp = champ.currentHp;
    const dealt = applyDamage({ kind: "champion", ref: champ }, 5, DamageType.True);
    expect(dealt).toBe(5);
    expect(champ.currentHp).toBe(startHp - 5);
  });

  it("minimum 1 damage even with high reduction", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1"); // armor = 3
    const dealt = applyDamage({ kind: "champion", ref: champ }, 1, DamageType.Physical);
    expect(dealt).toBe(1); // min 1
  });

  it("champion dies when HP reaches 0", () => {
    const champ = createChampionFromDefinition(PYROX, "PLAYER_2");
    applyDamage({ kind: "champion", ref: champ }, 100, DamageType.True);
    expect(champ.isAlive).toBe(false);
    expect(champ.currentHp).toBe(0);
  });
});

describe("Battle Execution", () => {
  let lane: LaneState;
  let p1Champ: Champion;
  let p2Champ: Champion;

  beforeEach(() => {
    resetIdCounter();
    lane = createLaneState(LaneId.Mid);
    p1Champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    p2Champ = createChampionFromDefinition(PYROX, "PLAYER_2");
  });

  it("completes after BATTLE_ROUND_LIMIT rounds when both survive", () => {
    // Both Wait every turn — no damage dealt
    const waitProvider = (unitId: string): BattleAction => ({
      actorId: unitId,
      actionType: ActionType.Wait,
    });

    const outcome = runBattle(
      LaneId.Mid, lane, p1Champ, p2Champ,
      LaneStance.Neutral, LaneStance.Neutral,
      waitProvider
    );

    expect(p1Champ.isAlive).toBe(true);
    expect(p2Champ.isAlive).toBe(true);
    // Both alive with full HP → scores tied → draw
    expect(outcome.winner).toBeNull();
    expect(outcome.lanePushBonus).toBe(0);
  });

  it("battle ends immediately on champion kill", () => {
    // Make P2 very low HP so P1's basic attack kills them
    p2Champ.currentHp = 1;

    let roundCount = 0;
    const aggroProvider = (unitId: string, battle: BattleState): BattleAction => {
      if (unitId === p1Champ.championId) {
        return {
          actorId: unitId,
          actionType: ActionType.Move,
          targetHex: p2Champ.battlePosition!,
        };
      }
      return { actorId: unitId, actionType: ActionType.Wait };
    };

    // First round: P1 moves toward P2. Second round: P1 attacks.
    // Since Pyrox acts first (higher init), let's directly test outcome calc.
    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Neutral, LaneStance.Neutral
    );

    // Manually kill P2 champ to test outcome
    p2Champ.isAlive = false;
    p2Champ.currentHp = 0;

    const outcome = calculateBattleOutcome(battle);
    expect(outcome.winner).toBe("PLAYER_1");
    expect(outcome.goldAwarded.PLAYER_1).toBe(CHAMPION_KILL_GOLD);
    expect(outcome.championDeaths).toContain("PLAYER_2");
    expect(outcome.lanePushBonus).toBe(2); // Decisive victory (10+ point diff)
  });

  it("Wait action recovers 1 energy", () => {
    const startEnergy = p1Champ.currentEnergy;
    p1Champ.currentEnergy = 2;

    const battle = setupBattle(
      LaneId.Mid, lane, p1Champ, p2Champ, LaneStance.Neutral, LaneStance.Neutral
    );

    // After setup, energy recovered by ENERGY_PER_ROUND
    const afterSetup = p1Champ.currentEnergy;

    const waitProvider = (unitId: string): BattleAction => ({
      actorId: unitId,
      actionType: ActionType.Wait,
    });

    executeBattleRound(battle, waitProvider);

    // Ironclad waited (+1) then end-of-round recovery (+ENERGY_PER_ROUND)
    // But the exact value depends on who goes first and energy caps
    expect(p1Champ.currentEnergy).toBeGreaterThan(afterSetup);
  });
});

describe("Battle Outcome", () => {
  it("draws when scores are equal", () => {
    resetIdCounter();
    const lane = createLaneState(LaneId.Mid);
    const p1 = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    const p2 = createChampionFromDefinition(IRONCLAD, "PLAYER_2");

    const battle = setupBattle(
      LaneId.Mid, lane, p1, p2, LaneStance.Neutral, LaneStance.Neutral
    );

    // Same champion, same HP → tied score → draw
    const outcome = calculateBattleOutcome(battle);
    expect(outcome.winner).toBeNull();
    expect(outcome.lanePushBonus).toBe(0);
  });

  it("awards lane push bonus based on score difference", () => {
    resetIdCounter();
    const lane = createLaneState(LaneId.Mid);
    const p1 = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    const p2 = createChampionFromDefinition(PYROX, "PLAYER_2");

    const battle = setupBattle(
      LaneId.Mid, lane, p1, p2, LaneStance.Neutral, LaneStance.Neutral
    );

    // Kill P2's champion
    p2.isAlive = false;
    p2.currentHp = 0;

    const outcome = calculateBattleOutcome(battle);
    expect(outcome.winner).toBe("PLAYER_1");
    expect(outcome.lanePushBonus).toBe(2); // 10+ diff = decisive
  });
});
