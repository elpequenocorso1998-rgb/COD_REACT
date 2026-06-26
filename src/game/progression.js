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
  8: { type: 'perk', name: 'Sleight of Hand', id: 'fastreload' },
  10: { type: 'weapon', name: 'Shotgun', id: 'shotgun' },
  12: { type: 'perk', name: 'Marathon', id: 'marathon' },
  15: { type: 'weapon', name: 'LMG', id: 'lmg' },
  20: { type: 'weapon', name: 'Pistol', id: 'pistol' }
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
    _state = { xp: 0, level: 1, unlocks: [], totalKills: 0, totalDeaths: 0, highestWave: 0 }
  }
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
  _state = { xp: 0, level: 1, unlocks: [], totalKills: 0, totalDeaths: 0, highestWave: 0 }
  saveState()
}
