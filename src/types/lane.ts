import { LaneId, PlayerId } from "./enums.js";

export interface MinionGroup {
  count: number;
  totalHp: number;
  attack: number;
}

export interface LaneZone {
  zoneIndex: number;
  minions: {
    player1: MinionGroup;
    player2: MinionGroup;
  };
  championsPresent: PlayerId[];
}

export interface LaneState {
  laneId: LaneId;
  frontlinePosition: number;
  zones: LaneZone[];
  towerHp: {
    player1: number;
    player2: number;
  };
  baseHp: {
    player1: number;
    player2: number;
  };
}
