/* =========================================================================
   Meta — capa de live service sobre progression.js (Fase 3).
   --------------------------------------------------------------------------
   Expone funciones de alto nivel para:
   - Stats de armas (nivel, XP, camos).
   - Battle pass (tier, premium, XP).
   - Daily challenges.
   - Prestige.

   Es solo lectura: mutations van via progression.js para mantener
   persistencia consistente en localStorage.
   ========================================================================= */

import {
  getWeaponLevel, getWeaponXP, getWeaponCamos, weaponXpForLevel,
  getBattlePass, getDailies, getProgress
} from '@/game/meta/progression'

// Devuelve un resumen completo del meta para mostrar en Barracks.
export function getMetaSummary() {
  const progress = getProgress()
  const bp = getBattlePass()
  const dailies = getDailies()
  return {
    playerLevel: progress.level,
    playerXP: progress.xp,
    playerXPNeeded: progress.xpNeeded,
    totalKills: progress.totalKills,
    totalDeaths: progress.totalDeaths,
    kd: progress.totalDeaths > 0
      ? (progress.totalKills / progress.totalDeaths).toFixed(2)
      : progress.totalKills.toFixed(2),
    highestWave: progress.highestWave,
    unlocks: progress.unlocks,
    battlePass: bp,
    dailies
  }
}

// Devuelve info de un arma concreta para la pantalla de weapon mastery.
export function getWeaponStats(weaponId) {
  return {
    level: getWeaponLevel(weaponId),
    xp: getWeaponXP(weaponId),
    xpNeeded: weaponXpForLevel(getWeaponLevel(weaponId)),
    camos: getWeaponCamos(weaponId),
    maxLevel: 30
  }
}

// Camos disponibles en el juego (catálogo).
export const CAMO_CATALOG = [
  { id: 'spray', name: 'Spray', color: 0x666666, level: 5 },
  { id: 'woodland', name: 'Woodland', color: 0x4a5a3a, level: 10 },
  { id: 'digital', name: 'Digital', color: 0x2a4a6a, level: 15 },
  { id: 'dragon', name: 'Dragon', color: 0x8a2a2a, level: 20 },
  { id: 'gold', name: 'Gold', color: 0xffd24d, level: 25 },
  { id: 'diamond', name: 'Diamond', color: 0x5cf0e0, level: 30 }
]

// Recompensas del battle pass por tier (free + premium).
export const BP_REWARDS = {
  5: { free: 'xp_boost_50', premium: 'skin_m4_silver' },
  10: { free: 'xp_boost_100', premium: 'operator_grim' },
  25: { free: 'calling_card', premium: 'skin_ak47_gold' },
  50: { free: 'emblem', premium: 'skin_sniper_obsidian' },
  100: { free: 'prestige_token', premium: 'skin_all_diamond' }
}

// Devuelve las recompensas disponibles en el tier actual del battle pass.
export function getAvailableBPRewards() {
  const bp = getBattlePass()
  const available = []
  for (const tierStr in BP_REWARDS) {
    const tier = parseInt(tierStr, 10)
    if (tier <= bp.tier) {
      available.push({ tier, ...BP_REWARDS[tier] })
    }
  }
  return available
}
