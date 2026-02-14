import { Phase, GameResult, LaneId, PlayerId } from "./enums.js";
import { Champion } from "./champion.js";
import { PlanningCard } from "./card.js";
import { LaneState } from "./lane.js";
import { BattleState } from "./battle.js";
import { TurnLogEntry } from "./log.js";

export interface PlayerState {
  playerId: PlayerId;
  gold: number;
  champions: Champion[];
  hand: PlanningCard[];
  deck: PlanningCard[];
  discard: PlanningCard[];
}

export interface GameState {
  turnNumber: number;
  phase: Phase;
  result: GameResult;
  players: [PlayerState, PlayerState];
  lanes: Record<LaneId, LaneState>;
  activeBattles: BattleState[];
  turnLog: TurnLogEntry[];
}
