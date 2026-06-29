/* =========================================================================
   Ranked / competitivo / esports.
   --------------------------------------------------------------------------
   - CDL ruleset: modos, mapas, armas/attachments/perks baneados.
   - SR (Skill Rating) ELO-like con tiers Bronze → Top 250.
   - Seasons de 1 mes.
   - Rewards por tier.
   - Persistencia localStorage (migrar a backend en Fase 12).
   ========================================================================= */

const RANKED_KEY = 'mw_ranked_v1'

export const CDL_MODES = ['searchDestroy', 'hardpoint', 'control']

export const CDL_MAPS = ['pamplona', 'urban', 'industrial', 'desert']

export const CDL_BANNED_WEAPONS = ['rpg', 'pila', 'deagle']

export const CDL_BANNED_ATTACHMENTS = ['grenadeLauncher', 'thermal', 'drumMag']

export const CDL_BANNED_PERKS = ['juggernaut', 'stoppingPower']

export const CDL_BANNED_FIELD_UPGRADES = ['emp', 'reconTower']

export const CDL_RULESET = {
  name: 'CDL Competitive',
  version: 1,
  teamSize: 4,
  bestOf: 11,
  modes: CDL_MODES,
  maps: CDL_MAPS,
  banned: {
    weapons: CDL_BANNED_WEAPONS,
    attachments: CDL_BANNED_ATTACHMENTS,
    perks: CDL_BANNED_PERKS,
    fieldUpgrades: CDL_BANNED_FIELD_UPGRADES
  },
  restricted: {
    sniperPerTeam: 1,
    smgPerTeam: 2
  },
  settings: {
    friendlyFire: true,
    miniMap: false,
    hitMarker: false,
    crosshair: false,
    scorestreaks: false
  }
}

export const TIERS = [
  { id: 'bronze', name: 'Bronze', minSR: 0, maxSR: 1499, color: 0x8a5a2a, icon: '🥉' },
  { id: 'silver', name: 'Silver', minSR: 1500, maxSR: 2999, color: 0x8a8a8a, icon: '🥈' },
  { id: 'gold', name: 'Gold', minSR: 3000, maxSR: 4499, color: 0xffd24d, icon: '🥇' },
  { id: 'platinum', name: 'Platinum', minSR: 4500, maxSR: 5999, color: 0x5cf0e0, icon: '💎' },
  { id: 'diamond', name: 'Diamond', minSR: 6000, maxSR: 7499, color: 0x4a9aff, icon: '💠' },
  { id: 'crimson', name: 'Crimson', minSR: 7500, maxSR: 8999, color: 0xff4a4a, icon: '🔴' },
  { id: 'iridescent', name: 'Iridescent', minSR: 9000, maxSR: 10999, color: 0xff5cf0, icon: '🌈' },
  { id: 'top250', name: 'Top 250', minSR: 11000, maxSR: 99999, color: 0xffd700, icon: '🏆' }
]

export const RANKED_REWARDS = {
  bronze: { xp: 1000, cosmetic: 'bronze_card' },
  silver: { xp: 2500, cosmetic: 'silver_card' },
  gold: { xp: 5000, cosmetic: 'gold_card', weaponCamo: 'gold' },
  platinum: { xp: 7500, cosmetic: 'platinum_card', weaponCamo: 'platinum' },
  diamond: { xp: 10000, cosmetic: 'diamond_card', weaponCamo: 'diamond' },
  crimson: { xp: 15000, cosmetic: 'crimson_card', operatorSkin: 'crimson' },
  iridescent: { xp: 20000, cosmetic: 'iridescent_card', operatorSkin: 'iridescent' },
  top250: { xp: 50000, cosmetic: 'top250_card', operatorSkin: 'top250', charm: 'champion' }
}

export const SR_CONFIG = {
  BASE_K: 32,
  WIN_BASE: 25,
  LOSS_BASE: -20,
  MVP_BONUS: 10,
  QUIT_PENALTY: -50,
  PLACEMENT_MATCHES: 10,
  DECAY_WEEKLY: -50,
  DECAY_THRESHOLD: 7500
}

let _state = null

function loadState() {
  if (_state) return _state
  try {
    const raw = localStorage.getItem(RANKED_KEY)
    if (raw) _state = JSON.parse(raw)
  } catch (e) { _state = null }
  if (!_state) {
    _state = {
      sr: 0,
      tier: 'bronze',
      placementMatchesPlayed: 0,
      placementsComplete: false,
      wins: 0,
      losses: 0,
      streak: 0,
      bestStreak: 0,
      mvpCount: 0,
      lastMatchAt: 0,
      seasonId: 1,
      history: []
    }
  }
  return _state
}

function saveState() {
  try {
    localStorage.setItem(RANKED_KEY, JSON.stringify(_state))
  } catch (e) { /* noop */ }
}

export function getTierForSR(sr) {
  for (const t of TIERS) {
    if (sr >= t.minSR && sr <= t.maxSR) return t
  }
  return TIERS[0]
}

export function getRankedStats() {
  return loadState()
}

export function getSR() {
  return loadState().sr
}

export function getCurrentTier() {
  return getTierForSR(loadState().sr)
}

export function isPlacementsComplete() {
  return loadState().placementsComplete
}

export function getPlacementMatchesRemaining() {
  const s = loadState()
  return Math.max(0, SR_CONFIG.PLACEMENT_MATCHES - s.placementMatchesPlayed)
}

export function recordMatch({ won, mvp = false, quit = false, opponentAvgSR = 0 }) {
  const s = loadState()
  const mySR = s.sr
  const expected = 1 / (1 + Math.pow(10, (opponentAvgSR - mySR) / 400))
  const actual = won ? 1 : 0
  const k = SR_CONFIG.BASE_K
  let srDelta = k * (actual - expected)

  if (!s.placementsComplete) {
    srDelta = won ? SR_CONFIG.WIN_BASE : SR_CONFIG.LOSS_BASE / 2
    s.placementMatchesPlayed++
    if (s.placementMatchesPlayed >= SR_CONFIG.PLACEMENT_MATCHES) {
      s.placementsComplete = true
    }
  }

  if (mvp && won) srDelta += SR_CONFIG.MVP_BONUS
  if (quit) srDelta = SR_CONFIG.QUIT_PENALTY

  s.sr = Math.max(0, Math.round(s.sr + srDelta))
  s.tier = getTierForSR(s.sr).id
  if (!quit) {
    if (won) {
      s.wins++
      s.streak = s.streak >= 0 ? s.streak + 1 : 1
    } else {
      s.losses++
      s.streak = s.streak <= 0 ? s.streak - 1 : -1
    }
    if (Math.abs(s.streak) > Math.abs(s.bestStreak)) {
      s.bestStreak = s.streak
    }
  }
  if (mvp) s.mvpCount++
  s.lastMatchAt = Date.now()
  s.history.push({
    at: s.lastMatchAt,
    won: won && !quit,
    mvp,
    quit,
    srBefore: mySR,
    srAfter: s.sr,
    delta: s.sr - mySR
  })
  if (s.history.length > 50) s.history.shift()
  saveState()
  return {
    srBefore: mySR,
    srAfter: s.sr,
    delta: s.sr - mySR,
    tier: getTierForSR(s.sr),
    placementsComplete: s.placementsComplete
  }
}

export function applyWeeklyDecay() {
  const s = loadState()
  if (s.sr < SR_CONFIG.DECAY_THRESHOLD) return 0
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  if (s.lastMatchAt < weekAgo) {
    const decay = SR_CONFIG.DECAY_WEEKLY
    s.sr = Math.max(SR_CONFIG.DECAY_THRESHOLD, s.sr + decay)
    s.tier = getTierForSR(s.sr).id
    saveState()
    return decay
  }
  return 0
}

export function getStreak() {
  return loadState().streak
}

export function getWinRate() {
  const s = loadState()
  const total = s.wins + s.losses
  if (total === 0) return 0
  return s.wins / total
}

export function getRewardsForTier(tierId) {
  return RANKED_REWARDS[tierId] || null
}

export function resetRanked() {
  _state = {
    sr: 0,
    tier: 'bronze',
    placementMatchesPlayed: 0,
    placementsComplete: false,
    wins: 0,
    losses: 0,
    streak: 0,
    bestStreak: 0,
    mvpCount: 0,
    lastMatchAt: 0,
    seasonId: 1,
    history: []
  }
  saveState()
}

export function isWeaponBanned(weaponId) {
  return CDL_BANNED_WEAPONS.includes(weaponId)
}

export function isAttachmentBanned(attId) {
  return CDL_BANNED_ATTACHMENTS.includes(attId)
}

export function isPerkBanned(perkId) {
  return CDL_BANNED_PERKS.includes(perkId)
}

export function isFieldUpgradeBanned(fuId) {
  return CDL_BANNED_FIELD_UPGRADES.includes(fuId)
}
