import { LaneId, PlayerId } from "./enums.js";

export interface LaneAssignment {
  laneId: LaneId;
  cardId: string;
  championId?: string;
}

export interface MinionSpawnOrder {
  laneId: LaneId;
  count: number;
}

export interface PlanningSubmission {
  playerId: PlayerId;
  laneAssignments: LaneAssignment[];
  minionSpawnOrders: MinionSpawnOrder[];
}
