export enum Phase {
  Planning = "PLANNING",
  Resolution = "RESOLUTION",
  Battle = "BATTLE",
}

export enum LaneId {
  Top = "TOP",
  Mid = "MID",
  Bot = "BOT",
}

export enum LaneStance {
  Aggro = "AGGRO",
  Defend = "DEFEND",
  Neutral = "NEUTRAL",
  Ambush = "AMBUSH",
}

export enum ChampionRole {
  Tank = "TANK",
  Fighter = "FIGHTER",
  Mage = "MAGE",
  Support = "SUPPORT",
  Assassin = "ASSASSIN",
}

export enum AbilityTargetType {
  Self = "SELF",
  SingleEnemy = "SINGLE_ENEMY",
  SingleAlly = "SINGLE_ALLY",
  AreaOfEffect = "AOE",
  Line = "LINE",
  Cone = "CONE",
}

export enum ActionType {
  Move = "MOVE",
  Attack = "ATTACK",
  Ability = "ABILITY",
  Defend = "DEFEND",
  Wait = "WAIT",
}

export enum DamageType {
  Physical = "PHYSICAL",
  Magical = "MAGICAL",
  True = "TRUE",
}

export enum GameResult {
  InProgress = "IN_PROGRESS",
  Player1Wins = "PLAYER_1_WINS",
  Player2Wins = "PLAYER_2_WINS",
  Draw = "DRAW",
}

export enum HexTerrain {
  Open = "OPEN",
  Blocked = "BLOCKED",
  Bush = "BUSH",
  HighGround = "HIGH_GROUND",
}

export enum PlanningEffectType {
  BonusMinions = "BONUS_MINIONS",
  BonusGold = "BONUS_GOLD",
  MinionDamageBoost = "MINION_DAMAGE_BOOST",
  TowerDamageReduction = "TOWER_DAMAGE_REDUCTION",
  ScoutReveal = "SCOUT_REVEAL",
  FortifyMinions = "FORTIFY_MINIONS",
}

export enum StatusEffectType {
  Stun = "STUN",
  Slow = "SLOW",
  Shield = "SHIELD",
  BuffAttack = "BUFF_ATTACK",
  DebuffArmor = "DEBUFF_ARMOR",
}

export type PlayerId = "PLAYER_1" | "PLAYER_2";
