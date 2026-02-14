import { DamageType, StatusEffectType, ActionType } from "../types/enums.js";
import { Champion, StatusEffect, Ability } from "../types/champion.js";
import { BattleMinion } from "../types/minion.js";
import { BattleState } from "../types/battle.js";
import { BattleAction } from "../types/actions.js";
import { HexCoord } from "../types/hex.js";
import {
  hexDistance,
  hexNeighbors,
  getCell,
  isPassable,
  findPath,
  hexKey,
  hexEquals,
} from "./hex-grid.js";
import { MAX_ENERGY } from "../types/constants.js";

export type BattleUnit =
  | { kind: "champion"; ref: Champion }
  | { kind: "minion"; ref: BattleMinion };

export function getUnitPosition(unit: BattleUnit): HexCoord {
  return unit.kind === "champion" ? unit.ref.battlePosition! : unit.ref.position;
}

export function setUnitPosition(unit: BattleUnit, pos: HexCoord, battle: BattleState): void {
  // Clear old cell occupant
  const oldPos = getUnitPosition(unit);
  const oldCell = getCell(battle.grid, oldPos);
  if (oldCell) oldCell.occupantId = null;

  // Set new position
  if (unit.kind === "champion") {
    unit.ref.battlePosition = pos;
  } else {
    unit.ref.position = pos;
  }

  // Mark new cell occupied
  const newCell = getCell(battle.grid, pos);
  if (newCell) {
    newCell.occupantId = unit.kind === "champion" ? unit.ref.championId : unit.ref.minionId;
  }
}

export function getUnitId(unit: BattleUnit): string {
  return unit.kind === "champion" ? unit.ref.championId : unit.ref.minionId;
}

export function isUnitAlive(unit: BattleUnit): boolean {
  return unit.kind === "champion" ? unit.ref.isAlive : unit.ref.isAlive;
}

export function getUnitHp(unit: BattleUnit): number {
  return unit.kind === "champion" ? unit.ref.currentHp : unit.ref.hp;
}

export function findUnitById(battle: BattleState, id: string): BattleUnit | null {
  for (const bc of battle.champions) {
    if (bc.championRef.championId === id)
      return { kind: "champion", ref: bc.championRef };
  }
  for (const m of battle.minions) {
    if (m.minionId === id) return { kind: "minion", ref: m };
  }
  return null;
}

export function applyDamage(
  target: BattleUnit,
  rawDamage: number,
  damageType: DamageType
): number {
  let reduction = 0;

  if (target.kind === "champion") {
    const champ = target.ref;
    if (damageType === DamageType.Physical) reduction = champ.armor;
    if (damageType === DamageType.Magical) reduction = champ.magicResist;
    // True damage: no reduction

    // Shield status effects
    for (const effect of champ.statusEffects) {
      if (effect.type === StatusEffectType.Shield) reduction += effect.value;
    }

    const finalDamage = Math.max(1, rawDamage - reduction);
    champ.currentHp -= finalDamage;
    if (champ.currentHp <= 0) {
      champ.currentHp = 0;
      champ.isAlive = false;
    }
    return finalDamage;
  } else {
    // Minions have no armor
    const finalDamage = Math.max(1, rawDamage);
    target.ref.hp -= finalDamage;
    if (target.ref.hp <= 0) {
      target.ref.hp = 0;
      target.ref.isAlive = false;
    }
    return finalDamage;
  }
}

export function executeMove(
  actor: BattleUnit,
  targetHex: HexCoord,
  battle: BattleState,
  maxDist: number
): void {
  const start = getUnitPosition(actor);
  const path = findPath(battle.grid, start, targetHex, maxDist);
  if (path.length > 1) {
    // Move to the last passable hex in the path
    const dest = path[path.length - 1];
    setUnitPosition(actor, dest, battle);
  }
}

export function executeBasicAttack(
  actor: BattleUnit,
  target: BattleUnit,
  battle: BattleState
): number {
  if (actor.kind === "champion") {
    const champ = actor.ref;
    const dist = hexDistance(getUnitPosition(actor), getUnitPosition(target));
    if (dist > champ.attackRange) return 0;
    return applyDamage(target, champ.attackDamage, champ.damageType);
  } else {
    // Minion basic attack
    const dist = hexDistance(getUnitPosition(actor), getUnitPosition(target));
    if (dist > 1) return 0; // Minions are melee
    return applyDamage(target, actor.ref.attack, DamageType.Physical);
  }
}

export function executeAbility(
  actor: Champion,
  ability: Ability,
  targetId: string | undefined,
  targetHex: HexCoord | undefined,
  battle: BattleState
): void {
  if (ability.cooldownRemaining > 0) return;
  if (actor.currentEnergy < ability.energyCost) return;

  actor.currentEnergy -= ability.energyCost;
  ability.cooldownRemaining = ability.cooldownMax;

  // Execute scripted actions
  for (const step of ability.scriptedActions) {
    if (step.type === ActionType.Move && step.distance) {
      const dest = targetHex ?? getUnitPosition({ kind: "champion", ref: actor });
      executeMove(
        { kind: "champion", ref: actor },
        dest,
        battle,
        step.distance
      );
    }

    if (step.type === ActionType.Attack && step.damage !== undefined) {
      const target = targetId ? findUnitById(battle, targetId) : null;
      if (target && isUnitAlive(target)) {
        applyDamage(target, step.damage, step.damageType ?? actor.damageType);
        // Apply effects (push, stun, etc.)
        if (step.effects) {
          for (const effect of step.effects) {
            applyAbilityEffect(effect, target, actor, battle);
          }
        }
      }
    }

    if (step.type === ActionType.Ability && step.damage !== undefined) {
      // AoE or targeted ability damage
      if (step.target === "AOE" && targetHex) {
        // Damage all enemies in AoE radius
        const targets = getAllUnitsInRadius(battle, targetHex, ability.aoeRadius, actor.ownerId);
        for (const t of targets) {
          applyDamage(t, step.damage, step.damageType ?? ability.damageType);
        }
      } else if (targetId) {
        const target = findUnitById(battle, targetId);
        if (target && isUnitAlive(target)) {
          applyDamage(target, step.damage, step.damageType ?? ability.damageType);
        }
      }
    }

    if (step.type === ActionType.Defend && step.effects) {
      for (const effect of step.effects) {
        applyAbilityEffect(effect, { kind: "champion", ref: actor }, actor, battle);
      }
    }
  }
}

function applyAbilityEffect(
  effect: { type: string; value: number; duration: number },
  target: BattleUnit,
  source: Champion,
  battle: BattleState
): void {
  if (target.kind !== "champion") return; // Status effects only apply to champions for MVP

  const statusType = effect.type as StatusEffectType;
  if (Object.values(StatusEffectType).includes(statusType)) {
    target.ref.statusEffects.push({
      type: statusType,
      value: effect.value,
      remainingDuration: effect.duration,
      sourceAbilityId: source.championId,
    });
  }

  // Push effect: move target away from source
  if (effect.type === "PUSH" && effect.value > 0) {
    const sourcePos = source.battlePosition!;
    const targetPos = getUnitPosition(target);
    // Find direction away from source
    const dq = targetPos.q - sourcePos.q;
    const dr = targetPos.r - sourcePos.r;
    const pushDir: HexCoord = {
      q: dq === 0 ? 0 : dq > 0 ? 1 : -1,
      r: dr === 0 ? 0 : dr > 0 ? 1 : -1,
    };
    for (let i = 0; i < effect.value; i++) {
      const newPos: HexCoord = {
        q: getUnitPosition(target).q + pushDir.q,
        r: getUnitPosition(target).r + pushDir.r,
      };
      if (isPassable(battle.grid, newPos)) {
        setUnitPosition(target, newPos, battle);
      } else {
        break;
      }
    }
  }
}

function getAllUnitsInRadius(
  battle: BattleState,
  center: HexCoord,
  radius: number,
  excludeOwnerId: string
): BattleUnit[] {
  const units: BattleUnit[] = [];

  for (const bc of battle.champions) {
    if (
      bc.championRef.isAlive &&
      bc.championRef.ownerId !== excludeOwnerId &&
      hexDistance(bc.championRef.battlePosition!, center) <= radius
    ) {
      units.push({ kind: "champion", ref: bc.championRef });
    }
  }

  for (const m of battle.minions) {
    if (
      m.isAlive &&
      m.ownerId !== excludeOwnerId &&
      hexDistance(m.position, center) <= radius
    ) {
      units.push({ kind: "minion", ref: m });
    }
  }

  return units;
}

export function executeWait(actor: Champion): void {
  actor.currentEnergy = Math.min(actor.currentEnergy + 1, MAX_ENERGY);
}

export function executeDefend(actor: Champion): void {
  actor.statusEffects.push({
    type: StatusEffectType.Shield,
    value: 2,
    remainingDuration: 1,
    sourceAbilityId: "DEFEND_ACTION",
  });
}
