import {
  ChampionRole,
  DamageType,
  AbilityTargetType,
  StatusEffectType,
  LaneId,
  LaneStance,
  PlayerId,
} from "./enums.js";
import { HexCoord } from "./hex.js";
import { ScriptedAction } from "./actions.js";

export interface AbilityEffect {
  type: StatusEffectType | "DAMAGE" | "HEAL" | "PUSH" | "PULL";
  value: number;
  duration: number;
}

export interface Ability {
  abilityId: string;
  name: string;
  description: string;
  energyCost: number;
  cooldownMax: number;
  cooldownRemaining: number;
  range: number;
  targetType: AbilityTargetType;
  damageType: DamageType;
  baseDamage: number;
  aoeRadius: number;
  effects: AbilityEffect[];
  scriptedActions: ScriptedAction[];
}

export interface StatusEffect {
  type: StatusEffectType;
  value: number;
  remainingDuration: number;
  sourceAbilityId: string;
}

export interface Champion {
  championId: string;
  name: string;
  role: ChampionRole;
  ownerId: PlayerId;

  maxHp: number;
  currentHp: number;
  armor: number;
  magicResist: number;
  maxEnergy: number;
  currentEnergy: number;
  moveSpeed: number;
  attackRange: number;
  attackDamage: number;
  damageType: DamageType;

  level: number;
  xp: number;

  abilities: Ability[];

  assignedLane: LaneId | null;
  laneStance: LaneStance | null;
  currentZone: number | null;

  battlePosition: HexCoord | null;
  isAlive: boolean;
  respawnTimer: number;

  statusEffects: StatusEffect[];
}

/** Template used to create champion instances. Omits runtime state fields. */
export interface ChampionDefinition {
  championId: string;
  name: string;
  role: ChampionRole;
  maxHp: number;
  armor: number;
  magicResist: number;
  maxEnergy: number;
  moveSpeed: number;
  attackRange: number;
  attackDamage: number;
  damageType: DamageType;
  abilities: Omit<Ability, "cooldownRemaining">[];
}
