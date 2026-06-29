/* =========================================================================
   Progresión — XP, niveles y unlocks con persistencia en localStorage.
   --------------------------------------------------------------------------
   - XP se gana al matar enemigos (10× score) y al morir (consolación 50).
   - Cada nivel requiere más XP: umbral = 1000 + level * 250.
   - Catálogo de unlocks por nivel (placeholders de armas/attachments que
     se llenarán cuando llegue Fase 1 con el arsenal real).
   - Persistencia en localStorage para que el progreso sobreviva recargas.
   ========================================================================= */

const STORAGE_KEY = 'mw_progress_v1'
const BASE_XP = 1000          // XP para nivel 1→2
const XP_PER_LEVEL = 250      // incremento por nivel

// Catálogo de unlocks por nivel. Lo expandiremos en Fase 1 (arsenal real).
const UNLOCK_CATALOG = {
  2: { type: 'weapon', name: 'MP5 SMG', id: 'mp5' },
  3: { type: 'attachment', name: 'Red Dot Sight', id: 'reddot' },
  4: { type: 'perk', name: 'Scavenger', id: 'scavenger' },
  5: { type: 'weapon', name: 'AK-47', id: 'ak47' },
  6: { type: 'attachment', name: 'Suppressor', id: 'suppressor' },
  7: { type: 'weapon', name: 'Sniper Rifle', id: 'sniper' },
  8: { type: 'perk', name: 'Sleight of Hand', id: 'sleightOfHand' },
  9: { type: 'weapon', name: 'X16', id: 'x16' },
  10: { type: 'weapon', name: 'Shotgun', id: 'shotgun' },
  11: { type: 'attachment', name: 'Foregrip', id: 'foregrip' },
  12: { type: 'perk', name: 'Marathon', id: 'marathon' },
  13: { type: 'weapon', name: 'MP7', id: 'mp7' },
  14: { type: 'attachment', name: 'Extended Mags', id: 'extendedmags' },
  15: { type: 'weapon', name: 'LMG', id: 'lmg' },
  16: { type: 'weapon', name: 'Kilo 141', id: 'kilo141' },
  17: { type: 'attachment', name: 'ACOG Scope', id: 'acog' },
  18: { type: 'perk', name: 'Lightweight', id: 'lightweight' },
  19: { type: 'weapon', name: 'Grau 5.56', id: 'grau' },
  20: { type: 'weapon', name: 'Pistol', id: 'pistol' },
  21: { type: 'attachment', name: 'Compensator', id: 'compensator' },
  22: { type: 'weapon', name: 'HDR', id: 'hdr' },
  23: { type: 'weapon', name: 'P90', id: 'p90' },
  24: { type: 'perk', name: 'Stopping Power', id: 'stoppingPower' },
  25: { type: 'attachment', name: 'Quickdraw Handle', id: 'quickdraw' },
  26: { type: 'weapon', name: 'FR 5.56', id: 'fr556' },
  27: { type: 'weapon', name: 'Model 680', id: 'model680' },
  28: { type: 'attachment', name: 'FMJ', id: 'fmj' },
  29: { type: 'weapon', name: 'EBR-14', id: 'ebr14' },
  30: { type: 'weapon', name: 'M91', id: 'm91' },
  31: { type: 'perk', name: 'Juggernaut', id: 'juggernaut' },
  32: { type: 'attachment', name: 'VLK 3.0x Optic', id: 'vlk' },
  33: { type: 'weapon', name: 'Oden', id: 'oden' },
  34: { type: 'weapon', name: 'AX-50', id: 'ax50' },
  35: { type: 'attachment', name: 'Thermal Scope', id: 'thermal' },
  36: { type: 'weapon', name: 'Uzi', id: 'uzi' },
  37: { type: 'weapon', name: 'MK2 Carbine', id: 'mk2' },
  38: { type: 'attachment', name: 'Drum Mag', id: 'drumMag' },
  39: { type: 'weapon', name: 'Kar98k', id: 'kar98k' },
  40: { type: 'weapon', name: 'AUG', id: 'aug' },
  41: { type: 'perk', name: 'Steady Aim', id: 'steadyAim' },
  42: { type: 'attachment', name: 'Tac Laser', id: 'tacLaser' },
  43: { type: 'weapon', name: 'R9-0', id: 'r90' },
  44: { type: 'weapon', name: 'PKM', id: 'pkm' },
  45: { type: 'attachment', name: 'Bipod', id: 'bipod' },
  46: { type: 'weapon', name: 'Desert Eagle', id: 'deagle' },
  47: { type: 'weapon', name: 'RPG-7', id: 'rpg' },
  48: { type: 'attachment', name: 'Fast Mag', id: 'fastMag' },
  49: { type: 'weapon', name: 'PILA', id: 'pila' },
  50: { type: 'perk', name: 'Ghost', id: 'ghost' },
  51: { type: 'fieldUpgrade', name: 'Trophy System', id: 'trophySystem' },
  52: { type: 'fieldUpgrade', name: 'Dead Silence', id: 'deadSilenceField' },
  53: { type: 'fieldUpgrade', name: 'EMP', id: 'emp' },
  54: { type: 'fieldUpgrade', name: 'Deployable Cover', id: 'deployableCover' },
  55: { type: 'fieldUpgrade', name: 'Recon Drone', id: 'reconDrone' },
  56: { type: 'perk', name: 'Cold-Blooded', id: 'coldBlooded' },
  57: { type: 'perk', name: 'Ninja', id: 'ninja' },
  58: { type: 'perk', name: 'Commando', id: 'commando' },
  60: { type: 'fieldUpgrade', name: 'Munitions Box', id: 'munitionsBox' },
  65: { type: 'fieldUpgrade', name: 'Recon Tower', id: 'reconTower' },
  70: { type: 'fieldUpgrade', name: 'Suppressing Drone', id: 'suppressingDrone' }
}

let _state = null

function loadState() {
  if (_state) return _state
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      _state = JSON.parse(raw)
      // Sanity check de campos.
      if (typeof _state.xp !== 'number' || typeof _state.level !== 'number') _state = null
    }
  } catch (e) { _state = null }
  if (!_state) {
    _state = {
      xp: 0, level: 1, unlocks: [], totalKills: 0, totalDeaths: 0, highestWave: 0,
      // Fase 3: weapon XP/niveles por arma + camos desbloqueados.
      weaponXP: {},      // { weaponId: xp }
      weaponLevel: {},   // { weaponId: level }
      weaponCamos: {},   // { weaponId: [camoId, ...] }
      // Fase 3: daily challenges y battle pass.
      dailies: {},       // { challengeId: { progress, claimed, date } }
      battlePass: { tier: 0, premium: false, xp: 0 }
    }
  }
  // Fase 7: guard contra estado legacy sin campos Fase 3.
  // Sin esto, getDailies() crasheaba en s.dailies.date si dailies era undefined.
  if (!_state.dailies || typeof _state.dailies !== 'object') _state.dailies = {}
  if (!_state.weaponXP) _state.weaponXP = {}
  if (!_state.weaponLevel) _state.weaponLevel = {}
  if (!_state.weaponCamos) _state.weaponCamos = {}
  if (!_state.battlePass) _state.battlePass = { tier: 0, premium: false, xp: 0 }
  if (!_state.unlocks) _state.unlocks = []
  return _state
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state))
  } catch (e) { /* localStorage puede no estar disponible en algunos contextos */ }
}

// XP necesaria para subir del nivel actual al siguiente.
export function xpForNextLevel(level) {
  return BASE_XP + (level - 1) * XP_PER_LEVEL
}

// Devuelve el unlock de un nivel dado, o null.
export function getUnlockForLevel(level) {
  return UNLOCK_CATALOG[level] || null
}

// Añade XP y sube de nivel si corresponde. Devuelve info del level up.
export function addXP(amount) {
  const s = loadState()
  s.xp += amount
  let leveledUp = false
  let newUnlocks = []
  while (s.xp >= xpForNextLevel(s.level)) {
    s.xp -= xpForNextLevel(s.level)
    s.level += 1
    leveledUp = true
    const unlock = getUnlockForLevel(s.level)
    if (unlock && !s.unlocks.find((u) => u.id === unlock.id)) {
      s.unlocks.push(unlock)
      newUnlocks.push(unlock)
    }
  }
  saveState()
  return { leveledUp, newLevel: s.level, newUnlocks, xp: s.xp, xpNeeded: xpForNextLevel(s.level) }
}

// Registra una kill/muerte/oleada para stats persistentes.
export function recordKill() { const s = loadState(); s.totalKills++; saveState() }
export function recordDeath() { const s = loadState(); s.totalDeaths++; saveState() }
export function recordWave(wave) {
  const s = loadState()
  if (wave > s.highestWave) { s.highestWave = wave; saveState() }
}

// Getters sin mutar.
export function getProgress() {
  const s = loadState()
  return {
    xp: s.xp,
    level: s.level,
    xpNeeded: xpForNextLevel(s.level),
    unlocks: [...s.unlocks],
    totalKills: s.totalKills,
    totalDeaths: s.totalDeaths,
    highestWave: s.highestWave
  }
}

// Reset total (para testing o "nueva cuenta").
export function resetProgress() {
  _state = {
    xp: 0, level: 1, unlocks: [], totalKills: 0, totalDeaths: 0, highestWave: 0,
    weaponXP: {}, weaponLevel: {}, weaponCamos: {},
    dailies: {}, battlePass: { tier: 0, premium: false, xp: 0 }
  }
  saveState()
}

/* =========================================================================
   Fase 3 — Weapon leveling + camos + battle pass.
   ========================================================================= */

const WEAPON_XP_PER_LEVEL = 500
const WEAPON_MAX_LEVEL = 30

// Camos desbloqueables por rango de nivel de arma.
const WEAPON_CAMOS = {
  5: 'spray',
  10: 'woodland',
  15: 'digital',
  20: 'dragon',
  25: 'gold',
  30: 'diamond'
}

// XP necesaria para subir de nivel un arma (constante por ahora).
export function weaponXpForLevel(_level) {
  return WEAPON_XP_PER_LEVEL
}

// Devuelve el nivel de un arma (1 si nunca se ha usado).
export function getWeaponLevel(weaponId) {
  const s = loadState()
  return s.weaponLevel[weaponId] || 1
}

// Devuelve la XP actual del arma hacia el siguiente nivel.
export function getWeaponXP(weaponId) {
  const s = loadState()
  return s.weaponXP[weaponId] || 0
}

// Devuelve los camos desbloqueados de un arma.
export function getWeaponCamos(weaponId) {
  const s = loadState()
  return s.weaponCamos[weaponId] || []
}

// Añade XP a un arma y sube de nivel si corresponde. Devuelve info.
export function addWeaponXP(weaponId, amount) {
  const s = loadState()
  if (!s.weaponXP[weaponId]) s.weaponXP[weaponId] = 0
  if (!s.weaponLevel[weaponId]) s.weaponLevel[weaponId] = 1
  if (!s.weaponCamos[weaponId]) s.weaponCamos[weaponId] = []
  s.weaponXP[weaponId] += amount
  let leveledUp = false
  let newCamo = null
  while (s.weaponLevel[weaponId] < WEAPON_MAX_LEVEL &&
         s.weaponXP[weaponId] >= WEAPON_XP_PER_LEVEL) {
    s.weaponXP[weaponId] -= WEAPON_XP_PER_LEVEL
    s.weaponLevel[weaponId] += 1
    leveledUp = true
    // Desbloquea camo si corresponde.
    const camo = WEAPON_CAMOS[s.weaponLevel[weaponId]]
    if (camo && !s.weaponCamos[weaponId].includes(camo)) {
      s.weaponCamos[weaponId].push(camo)
      newCamo = camo
    }
  }
  saveState()
  return {
    leveledUp,
    newLevel: s.weaponLevel[weaponId],
    newCamo,
    xp: s.weaponXP[weaponId],
    xpNeeded: WEAPON_XP_PER_LEVEL
  }
}

// --- Battle Pass (Fase 3) ---
const BP_XP_PER_TIER = 1000
const BP_MAX_TIER = 100

export function getBattlePass() {
  const s = loadState()
  return { ...s.battlePass, xpNeeded: BP_XP_PER_TIER, maxTier: BP_MAX_TIER }
}

export function addBattlePassXP(amount) {
  const s = loadState()
  s.battlePass.xp += amount
  let tiersGained = 0
  while (s.battlePass.tier < BP_MAX_TIER && s.battlePass.xp >= BP_XP_PER_TIER) {
    s.battlePass.xp -= BP_XP_PER_TIER
    s.battlePass.tier += 1
    tiersGained++
  }
  saveState()
  return { tier: s.battlePass.tier, xp: s.battlePass.xp, tiersGained }
}

export function unlockBattlePassPremium() {
  const s = loadState()
  s.battlePass.premium = true
  saveState()
}

// --- Daily challenges (Fase 3) ---
const DAILY_CHALLENGES = [
  { id: 'kills_50', desc: 'Get 50 kills', target: 50, xp: 500 },
  { id: 'headshots_10', desc: 'Get 10 headshots', target: 10, xp: 750 },
  { id: 'waves_5', desc: 'Survive 5 waves', target: 5, xp: 600 },
  { id: 'multikill', desc: 'Get a multikill', target: 1, xp: 800 }
]

// Devuelve las dailies de hoy (genera nuevas si es un nuevo día).
export function getDailies() {
  const s = loadState()
  const today = new Date().toDateString()
  if (!s.dailies.date || s.dailies.date !== today) {
    // Genera 3 dailies aleatorias para hoy.
    const shuffled = [...DAILY_CHALLENGES].sort(() => Math.random() - 0.5)
    s.dailies = {
      date: today,
      challenges: shuffled.slice(0, 3).map((c) => ({ ...c, progress: 0, claimed: false }))
    }
    saveState()
  }
  return s.dailies.challenges
}

// Progresa una daily por id.
export function progressDaily(challengeId, amount = 1) {
  const s = loadState()
  if (!s.dailies.challenges) return
  for (const c of s.dailies.challenges) {
    if (c.id === challengeId && !c.claimed) {
      c.progress = Math.min(c.target, c.progress + amount)
      if (c.progress >= c.target) {
        // Auto-claim: da XP al player.
        addXP(c.xp)
        addBattlePassXP(c.xp / 2)
        c.claimed = true
      }
      saveState()
      break
    }
  }
}
