import { LaneId } from "../types/enums.js";
import { LaneState, LaneZone, MinionGroup } from "../types/lane.js";
import {
  LANE_ZONE_COUNT,
  INITIAL_FRONTLINE,
  TOWER_HP,
  BASE_HP,
  MINION_BASE_ATTACK,
} from "../types/constants.js";
import { clamp } from "../utils/math.js";

function emptyMinionGroup(): MinionGroup {
  return { count: 0, totalHp: 0, attack: MINION_BASE_ATTACK };
}

function createZone(index: number): LaneZone {
  return {
    zoneIndex: index,
    minions: {
      player1: emptyMinionGroup(),
      player2: emptyMinionGroup(),
    },
    championsPresent: [],
  };
}

export function createLaneState(laneId: LaneId): LaneState {
  const zones: LaneZone[] = [];
  for (let i = 0; i < LANE_ZONE_COUNT; i++) {
    zones.push(createZone(i));
  }
  return {
    laneId,
    frontlinePosition: INITIAL_FRONTLINE,
    zones,
    towerHp: { player1: TOWER_HP, player2: TOWER_HP },
    baseHp: { player1: BASE_HP, player2: BASE_HP },
  };
}

export function moveFrontline(lane: LaneState, delta: number): void {
  lane.frontlinePosition = clamp(lane.frontlinePosition + delta, 0, LANE_ZONE_COUNT - 1);
}

export function clearZoneMinions(zone: LaneZone): void {
  zone.minions.player1 = emptyMinionGroup();
  zone.minions.player2 = emptyMinionGroup();
}

export function clearZoneChampions(zone: LaneZone): void {
  zone.championsPresent = [];
}

export function clearAllChampions(lane: LaneState): void {
  for (const zone of lane.zones) {
    zone.championsPresent = [];
  }
}
