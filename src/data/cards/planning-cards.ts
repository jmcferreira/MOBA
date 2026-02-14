import { PlanningCard } from "../../types/card.js";
import { LaneStance, PlanningEffectType } from "../../types/enums.js";

export const ADVANCE: PlanningCard = {
  cardId: "ADVANCE",
  name: "Advance",
  stance: LaneStance.Aggro,
  effects: [],
  priority: 2,
};

export const RALLY_CHARGE: PlanningCard = {
  cardId: "RALLY_CHARGE",
  name: "Rally Charge",
  stance: LaneStance.Aggro,
  effects: [{ type: PlanningEffectType.BonusMinions, value: 1 }],
  priority: 1,
};

export const HOLD_THE_LINE: PlanningCard = {
  cardId: "HOLD_THE_LINE",
  name: "Hold the Line",
  stance: LaneStance.Defend,
  effects: [{ type: PlanningEffectType.TowerDamageReduction, value: 2 }],
  priority: 3,
};

export const FORTIFY: PlanningCard = {
  cardId: "FORTIFY",
  name: "Fortify",
  stance: LaneStance.Defend,
  effects: [{ type: PlanningEffectType.FortifyMinions, value: 1 }],
  priority: 4,
};

export const STEADY_PUSH: PlanningCard = {
  cardId: "STEADY_PUSH",
  name: "Steady Push",
  stance: LaneStance.Neutral,
  effects: [{ type: PlanningEffectType.BonusGold, value: 1 }],
  priority: 3,
};

export const GATHER_INTEL: PlanningCard = {
  cardId: "GATHER_INTEL",
  name: "Gather Intel",
  stance: LaneStance.Neutral,
  effects: [{ type: PlanningEffectType.ScoutReveal, value: 1 }],
  priority: 2,
};

export const FLANK_STRIKE: PlanningCard = {
  cardId: "FLANK_STRIKE",
  name: "Flank Strike",
  stance: LaneStance.Ambush,
  effects: [],
  priority: 1,
};

export const SHADOW_ASSAULT: PlanningCard = {
  cardId: "SHADOW_ASSAULT",
  name: "Shadow Assault",
  stance: LaneStance.Ambush,
  effects: [{ type: PlanningEffectType.MinionDamageBoost, value: 1 }],
  priority: 1,
};

export const ALL_PLANNING_CARDS: PlanningCard[] = [
  ADVANCE,
  RALLY_CHARGE,
  HOLD_THE_LINE,
  FORTIFY,
  STEADY_PUSH,
  GATHER_INTEL,
  FLANK_STRIKE,
  SHADOW_ASSAULT,
];
