import { LaneStance, PlanningEffectType } from "./enums.js";

export interface PlanningEffect {
  type: PlanningEffectType;
  value: number;
}

export interface PlanningCard {
  cardId: string;
  name: string;
  stance: LaneStance;
  effects: PlanningEffect[];
  priority: number;
}
