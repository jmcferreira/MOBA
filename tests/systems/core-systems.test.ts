import { describe, it, expect, beforeEach } from "vitest";
import {
  canAffordSpawn,
  validateSpawnOrders,
  deductSpawnCost,
  awardPassiveGold,
  awardMinionKillGold,
  awardChampionKillGold,
} from "../../src/systems/economy-system.js";
import { createLaneState, moveFrontline } from "../../src/systems/lane-system.js";
import {
  drawToHandLimit,
  playCard,
  sumCardEffects,
  shuffleDeck,
  createPlayerDeck,
} from "../../src/systems/card-system.js";
import {
  createChampionFromDefinition,
  tickRespawn,
  tickCooldowns,
  killChampion,
  checkLevelUp,
} from "../../src/systems/champion-system.js";
import { PlayerState } from "../../src/types/game-state.js";
import { LaneId, PlanningEffectType } from "../../src/types/enums.js";
import {
  PASSIVE_GOLD_PER_TURN,
  MINION_KILL_GOLD,
  CHAMPION_KILL_GOLD,
  INITIAL_FRONTLINE,
  LANE_ZONE_COUNT,
  TOWER_HP,
  BASE_HP,
  HAND_SIZE,
} from "../../src/types/constants.js";
import { ALL_PLANNING_CARDS } from "../../src/data/cards/planning-cards.js";
import { IRONCLAD } from "../../src/data/champions/ironclad.js";
import { PYROX } from "../../src/data/champions/pyrox.js";

// ── Economy System ──────────────────────────────────────────

describe("Economy System", () => {
  let player: PlayerState;

  beforeEach(() => {
    player = {
      playerId: "PLAYER_1",
      gold: 10,
      champions: [],
      hand: [],
      deck: [],
      discard: [],
    };
  });

  it("canAffordSpawn returns true when gold is sufficient", () => {
    expect(canAffordSpawn(player, [{ laneId: LaneId.Mid, count: 2 }])).toBe(true); // 2*2=4 <= 10
  });

  it("canAffordSpawn returns false when gold insufficient", () => {
    player.gold = 3;
    expect(canAffordSpawn(player, [{ laneId: LaneId.Mid, count: 3 }])).toBe(false); // 3*2=6 > 3
  });

  it("validateSpawnOrders rejects negative counts", () => {
    expect(validateSpawnOrders(player, [{ laneId: LaneId.Mid, count: -1 }])).toContain("Negative");
  });

  it("validateSpawnOrders rejects exceeding max per lane", () => {
    expect(validateSpawnOrders(player, [{ laneId: LaneId.Mid, count: 5 }])).toContain("Cannot spawn");
  });

  it("deductSpawnCost reduces gold correctly", () => {
    deductSpawnCost(player, [{ laneId: LaneId.Mid, count: 2 }]);
    expect(player.gold).toBe(6); // 10 - 4
  });

  it("awardPassiveGold adds correct amount", () => {
    awardPassiveGold(player);
    expect(player.gold).toBe(10 + PASSIVE_GOLD_PER_TURN);
  });

  it("awardMinionKillGold adds correct amount", () => {
    awardMinionKillGold(player, 3);
    expect(player.gold).toBe(10 + 3 * MINION_KILL_GOLD);
  });

  it("awardChampionKillGold adds correct amount", () => {
    awardChampionKillGold(player);
    expect(player.gold).toBe(10 + CHAMPION_KILL_GOLD);
  });
});

// ── Lane System ─────────────────────────────────────────────

describe("Lane System", () => {
  it("creates a lane with correct defaults", () => {
    const lane = createLaneState(LaneId.Mid);
    expect(lane.laneId).toBe(LaneId.Mid);
    expect(lane.frontlinePosition).toBe(INITIAL_FRONTLINE);
    expect(lane.zones.length).toBe(LANE_ZONE_COUNT);
    expect(lane.towerHp.player1).toBe(TOWER_HP);
    expect(lane.baseHp.player1).toBe(BASE_HP);
  });

  it("moveFrontline clamps within bounds", () => {
    const lane = createLaneState(LaneId.Mid);
    moveFrontline(lane, 10);
    expect(lane.frontlinePosition).toBe(LANE_ZONE_COUNT - 1);
    moveFrontline(lane, -20);
    expect(lane.frontlinePosition).toBe(0);
  });

  it("moveFrontline moves correctly within bounds", () => {
    const lane = createLaneState(LaneId.Mid);
    expect(lane.frontlinePosition).toBe(3);
    moveFrontline(lane, 1);
    expect(lane.frontlinePosition).toBe(4);
    moveFrontline(lane, -2);
    expect(lane.frontlinePosition).toBe(2);
  });
});

// ── Card System ─────────────────────────────────────────────

describe("Card System", () => {
  it("shuffleDeck with seed produces deterministic results", () => {
    const cards = [...ALL_PLANNING_CARDS];
    const a = shuffleDeck(cards, 42);
    const b = shuffleDeck(cards, 42);
    expect(a.map((c) => c.cardId)).toEqual(b.map((c) => c.cardId));
  });

  it("drawToHandLimit fills hand to HAND_SIZE", () => {
    const { deck, hand, discard } = createPlayerDeck(ALL_PLANNING_CARDS);
    const player: PlayerState = {
      playerId: "PLAYER_1",
      gold: 0,
      champions: [],
      hand,
      deck,
      discard,
    };
    drawToHandLimit(player);
    expect(player.hand.length).toBe(HAND_SIZE);
    expect(player.deck.length).toBe(ALL_PLANNING_CARDS.length - HAND_SIZE);
  });

  it("playCard removes card from hand and adds to discard", () => {
    const player: PlayerState = {
      playerId: "PLAYER_1",
      gold: 0,
      champions: [],
      hand: [...ALL_PLANNING_CARDS.slice(0, 3)],
      deck: [],
      discard: [],
    };
    const cardId = player.hand[1].cardId;
    const card = playCard(player, cardId);
    expect(card).not.toBeNull();
    expect(card!.cardId).toBe(cardId);
    expect(player.hand.length).toBe(2);
    expect(player.discard.length).toBe(1);
  });

  it("playCard returns null for missing card", () => {
    const player: PlayerState = {
      playerId: "PLAYER_1",
      gold: 0,
      champions: [],
      hand: [],
      deck: [],
      discard: [],
    };
    expect(playCard(player, "NONEXISTENT")).toBeNull();
  });

  it("sumCardEffects calculates correct totals", () => {
    const card = ALL_PLANNING_CARDS.find((c) => c.cardId === "RALLY_CHARGE")!;
    expect(sumCardEffects(card, PlanningEffectType.BonusMinions)).toBe(1);
    expect(sumCardEffects(card, PlanningEffectType.BonusGold)).toBe(0);
    expect(sumCardEffects(null, PlanningEffectType.BonusMinions)).toBe(0);
  });
});

// ── Champion System ─────────────────────────────────────────

describe("Champion System", () => {
  it("creates a champion from definition with correct defaults", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    expect(champ.ownerId).toBe("PLAYER_1");
    expect(champ.currentHp).toBe(IRONCLAD.maxHp);
    expect(champ.currentEnergy).toBe(IRONCLAD.maxEnergy);
    expect(champ.level).toBe(1);
    expect(champ.isAlive).toBe(true);
    expect(champ.respawnTimer).toBe(0);
    expect(champ.abilities.length).toBe(3);
    expect(champ.abilities[0].cooldownRemaining).toBe(0);
  });

  it("killChampion sets correct state", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    killChampion(champ);
    expect(champ.isAlive).toBe(false);
    expect(champ.currentHp).toBe(0);
    expect(champ.respawnTimer).toBe(1);
  });

  it("tickRespawn counts down and respawns at 0", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    killChampion(champ);
    expect(champ.respawnTimer).toBe(1);

    tickRespawn(champ);
    expect(champ.respawnTimer).toBe(0);
    expect(champ.isAlive).toBe(true);
    expect(champ.currentHp).toBe(champ.maxHp);
  });

  it("tickCooldowns reduces cooldowns by 1", () => {
    const champ = createChampionFromDefinition(IRONCLAD, "PLAYER_1");
    champ.abilities[0].cooldownRemaining = 2;
    champ.abilities[1].cooldownRemaining = 1;
    champ.abilities[2].cooldownRemaining = 0;

    tickCooldowns(champ);
    expect(champ.abilities[0].cooldownRemaining).toBe(1);
    expect(champ.abilities[1].cooldownRemaining).toBe(0);
    expect(champ.abilities[2].cooldownRemaining).toBe(0);
  });

  it("checkLevelUp levels up when XP threshold met", () => {
    const champ = createChampionFromDefinition(PYROX, "PLAYER_2");
    expect(champ.level).toBe(1);
    champ.xp = 3; // Threshold for level 2
    const leveled = checkLevelUp(champ);
    expect(leveled).toBe(true);
    expect(champ.level).toBe(2);
    expect(champ.maxHp).toBe(PYROX.maxHp + 2);
    expect(champ.attackDamage).toBe(PYROX.attackDamage + 1);
  });

  it("checkLevelUp does not level up below threshold", () => {
    const champ = createChampionFromDefinition(PYROX, "PLAYER_2");
    champ.xp = 2;
    expect(checkLevelUp(champ)).toBe(false);
    expect(champ.level).toBe(1);
  });
});
