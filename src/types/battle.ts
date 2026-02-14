import { LaneId, PlayerId } from "./enums.js";
import { HexGrid, HexCoord } from "./hex.js";
import { Champion } from "./champion.js";
import { BattleMinion } from "./minion.js";

export interface BattleChampion {
  championRef: Champion;
  position: HexCoord;
  hasActed: boolean;
}

export interface BattleState {
  laneId: LaneId;
  roundNumber: number;
  grid: HexGrid;
  turnOrder: string[];
  currentTurnIndex: number;
  champions: BattleChampion[];
  minions: BattleMinion[];
  isComplete: boolean;
  outcome: BattleOutcome | null;
}

export interface BattleOutcome {
  winner: PlayerId | null;
  lanePushBonus: number;
  goldAwarded: Record<PlayerId, number>;
  xpAwarded: Record<PlayerId, number>;
  championDeaths: PlayerId[];
  damageToStructures: number;
}
