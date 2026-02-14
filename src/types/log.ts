import { LaneId, PlayerId } from "./enums.js";
import { PlanningSubmission } from "./planning.js";
import { BattleOutcome } from "./battle.js";

export interface MinionCombatLog {
  player1MinionsStart: number;
  player2MinionsStart: number;
  player1MinionsEnd: number;
  player2MinionsEnd: number;
  player1Casualties: number;
  player2Casualties: number;
}

export interface ResolutionResult {
  laneId: LaneId;
  minionCombatLog: MinionCombatLog;
  frontlineBefore: number;
  frontlineAfter: number;
  battleTriggered: boolean;
  towerDamage: Record<PlayerId, number>;
}

export interface TurnLogEntry {
  turnNumber: number;
  planningSubmissions: [PlanningSubmission, PlanningSubmission];
  resolutionResults: ResolutionResult[];
  battleResults: BattleOutcome[];
  goldChanges: Record<PlayerId, number>;
}
