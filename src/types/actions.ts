import { ActionType, DamageType, AbilityTargetType } from "./enums.js";
import { AbilityEffect } from "./champion.js";
import { HexCoord } from "./hex.js";

export interface ScriptedCondition {
  type: "TARGET_IN_RANGE" | "HP_BELOW_PERCENT" | "HAS_STATUS" | "ALLY_ADJACENT";
  value: number;
}

export interface ScriptedAction {
  type: ActionType;
  direction?: HexCoord;
  distance?: number;
  target?: AbilityTargetType;
  damage?: number;
  damageType?: DamageType;
  effects?: AbilityEffect[];
  condition?: ScriptedCondition;
}

export interface BattleAction {
  actorId: string;
  actionType: ActionType;
  abilityId?: string;
  targetId?: string;
  targetHex?: HexCoord;
}
