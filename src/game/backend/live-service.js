/* =========================================================================
   Live service: store, COD Points, prestige, seasons, challenges.
   --------------------------------------------------------------------------
   - Store: bundles, weapon blueprints, operator skins, calling cards.
   - COD Points: currency comprada con dinero real.
   - Battle Pass v2: 100+ tiers, sector system, free + premium.
   - Seasons: contenido cada 3 meses.
   - Prestige: reset tras nivel max con icono.
   - Challenges: daily, weekly, seasonal, weapon, camo.
   Persistencia localStorage (migrar a backend en Fase 12).
   ========================================================================= */

const LIVE_KEY = 'mw_live_v1'

let _state = null

function loadState() {
  if (_state) return _state
  try {
    const raw = localStorage.getItem(LIVE_KEY)
    if (raw) _state = JSON.parse(raw)
  } catch (e) { _state = null }
  if (!_state) {
    _state = {
      codPoints: 0,
      purchasedItems: [],
      battlePass: { seasonId: 1, tier: 0, xp: 0, premium: false, claimedTiers: [] },
      prestige: { level: 0, icon: 'default', tokens: 0 },
      season: { id: 1, name: 'Season 1', xp: 0 },
      challenges: { daily: [], weekly: [], seasonal: [], lastDailyReset: 0, lastWeeklyReset: 0 }
    }
  }
  return _state
}

function saveState() {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(_state))
  } catch (e) { /* noop */ }
}

export const STORE_ITEMS = {
  bundle_operator_veteran: {
    id: 'bundle_operator_veteran', name: 'Veteran Operator Bundle',
    type: 'bundle', price: 2400, items: ['operator_veteran', 'm4_blueprint_veteran', 'card_veteran']
  },
  bundle_neon_strike: {
    id: 'bundle_neon_strike', name: 'Neon Strike Bundle',
    type: 'bundle', price: 1800, items: ['operator_neon', 'mp5_blueprint_neon', 'card_neon']
  },
  blueprint_m4_gold: {
    id: 'blueprint_m4_gold', name: 'M4 - Gold',
    type: 'blueprint', price: 1200, weapon: 'm4', cosmetic: 'gold'
  },
  blueprint_ak47_dragon: {
    id: 'blueprint_ak47_dragon', name: 'AK-47 - Dragon',
    type: 'blueprint', price: 1500, weapon: 'ak47', cosmetic: 'dragon'
  },
  operator_ghost: {
    id: 'operator_ghost', name: 'Ghost Operator',
    type: 'operator', price: 1000
  },
  operator_price: {
    id: 'operator_price', name: 'Captain Price',
    type: 'operator', price: 1000
  },
  operator_soap: {
    id: 'operator_soap', name: 'Soap',
    type: 'operator', price: 1000
  },
  calling_card_legend: {
    id: 'calling_card_legend', name: 'Legendary Card',
    type: 'calling_card', price: 500
  },
  emblem_ghillie: {
    id: 'emblem_ghillie', name: 'Ghillie Emblem',
    type: 'emblem', price: 300
  },
  spray_bang: {
    id: 'spray_bang', name: 'Bang Spray',
    type: 'spray', price: 200
  },
  finishing_move_neck_snap: {
    id: 'finishing_move_neck_snap', name: 'Neck Snap',
    type: 'finishing_move', price: 800
  }
}

export const PRESTIGE_LEVELS = [
  { level: 0, name: 'No Prestige', icon: 'default', requiredLevel: 55 },
  { level: 1, name: 'Prestige 1', icon: 'prestige1', requiredLevel: 55 },
  { level: 2, name: 'Prestige 2', icon: 'prestige2', requiredLevel: 55 },
  { level: 3, name: 'Prestige 3', icon: 'prestige3', requiredLevel: 55 },
  { level: 4, name: 'Prestige 4', icon: 'prestige4', requiredLevel: 55 },
  { level: 5, name: 'Prestige 5', icon: 'prestige5', requiredLevel: 55 },
  { level: 6, name: 'Prestige 6', icon: 'prestige6', requiredLevel: 55 },
  { level: 7, name: 'Prestige 7', icon: 'prestige7', requiredLevel: 55 },
  { level: 8, name: 'Prestige 8', icon: 'prestige8', requiredLevel: 55 },
  { level: 9, name: 'Prestige 9', icon: 'prestige9', requiredLevel: 55 },
  { level: 10, name: 'Prestige Master', icon: 'master', requiredLevel: 55 }
]

export const SEASON_CONFIG = {
  duration: 90,
  tiers: 100,
  xpPerTier: 1000,
  sectorSize: 5
}

export const CHALLENGE_TEMPLATES = {
  daily: [
    { id: 'kills_50', name: 'Get 50 kills', target: 50, xp: 2500 },
    { id: 'headshots_10', name: 'Get 10 headshots', target: 10, xp: 2500 },
    { id: 'wins_3', name: 'Win 3 matches', target: 3, xp: 3000 },
    { id: 'multikill_2', name: 'Get 2 multikills', target: 2, xp: 2500 },
    { id: 'objective_5', name: 'Capture 5 objectives', target: 5, xp: 2500 },
    { id: 'games_played_5', name: 'Play 5 matches', target: 5, xp: 2000 }
  ],
  weekly: [
    { id: 'kills_250', name: 'Get 250 kills', target: 250, xp: 10000 },
    { id: 'headshots_50', name: 'Get 50 headshots', target: 50, xp: 10000 },
    { id: 'wins_10', name: 'Win 10 matches', target: 10, xp: 12000 },
    { id: 'xp_50000', name: 'Earn 50,000 XP', target: 50000, xp: 15000 },
    { id: 'kills_with_ar_100', name: '100 kills with ARs', target: 100, xp: 10000 }
  ],
  seasonal: [
    { id: 'kills_1000', name: 'Get 1000 kills this season', target: 1000, xp: 50000 },
    { id: 'wins_50', name: 'Win 50 matches this season', target: 50, xp: 50000 },
    { id: 'max_weapon_1', name: 'Max out 1 weapon', target: 1, xp: 50000 }
  ],
  weapon: [
    { id: 'kills_50', name: '50 kills', target: 50, xp: 1000, camo: 'spray' },
    { id: 'headshots_50', name: '50 headshots', target: 50, xp: 1000, camo: 'woodland' },
    { id: 'kills_no_attachment_50', name: '50 kills no attachments', target: 50, xp: 1000, camo: 'digital' },
    { id: 'kills_longshot_50', name: '50 longshots', target: 50, xp: 1000, camo: 'dragon' },
    { id: 'kills_100', name: '100 kills', target: 100, xp: 2000, camo: 'gold' },
    { id: 'headshots_100', name: '100 headshots', target: 100, xp: 2000, camo: 'diamond' }
  ]
}

export function getLiveState() {
  return loadState()
}

export function getCodPoints() {
  return loadState().codPoints
}

export function addCodPoints(amount) {
  const s = loadState()
  s.codPoints += amount
  saveState()
  return s.codPoints
}

export function purchaseItem(itemId) {
  const s = loadState()
  const item = STORE_ITEMS[itemId]
  if (!item) return { ok: false, reason: 'not_found' }
  if (s.purchasedItems.includes(itemId)) return { ok: false, reason: 'already_owned' }
  if (s.codPoints < item.price) return { ok: false, reason: 'insufficient_cp' }
  s.codPoints -= item.price
  s.purchasedItems.push(itemId)
  saveState()
  return { ok: true, item, remainingCP: s.codPoints }
}

export function isItemOwned(itemId) {
  return loadState().purchasedItems.includes(itemId)
}

export function getOwnedItems() {
  return [...loadState().purchasedItems]
}

export function getBattlePass() {
  return loadState().battlePass
}

export function addBattlePassXP(amount) {
  const s = loadState()
  s.battlePass.xp += amount
  while (s.battlePass.xp >= SEASON_CONFIG.xpPerTier && s.battlePass.tier < SEASON_CONFIG.tiers) {
    s.battlePass.xp -= SEASON_CONFIG.xpPerTier
    s.battlePass.tier++
  }
  saveState()
  return s.battlePass
}

export function claimBattlePassReward(tier) {
  const s = loadState()
  if (tier > s.battlePass.tier) return { ok: false, reason: 'not_unlocked' }
  if (s.battlePass.claimedTiers.includes(tier)) return { ok: false, reason: 'already_claimed' }
  if (!s.battlePass.premium && tier % 5 !== 0) return { ok: false, reason: 'premium_required' }
  s.battlePass.claimedTiers.push(tier)
  saveState()
  return { ok: true, tier }
}

export function upgradeToPremium() {
  const s = loadState()
  if (s.battlePass.premium) return { ok: false, reason: 'already_premium' }
  if (s.codPoints < 1000) return { ok: false, reason: 'insufficient_cp' }
  s.codPoints -= 1000
  s.battlePass.premium = true
  saveState()
  return { ok: true }
}

export function purchaseBattlePassBundle() {
  const s = loadState()
  if (s.battlePass.premium) return { ok: false, reason: 'already_premium' }
  if (s.codPoints < 2400) return { ok: false, reason: 'insufficient_cp' }
  s.codPoints -= 2400
  s.battlePass.premium = true
  s.battlePass.tier = Math.min(20, s.battlePass.tier + 20)
  saveState()
  return { ok: true }
}

export function getPrestige() {
  return loadState().prestige
}

export function canPrestige(playerLevel) {
  return playerLevel >= 55 && getPrestige().level < 10
}

export function prestige() {
  const s = loadState()
  if (s.prestige.level >= 10) return { ok: false, reason: 'max_prestige' }
  s.prestige.level++
  s.prestige.tokens++
  s.prestige.icon = PRESTIGE_LEVELS[s.prestige.level].icon
  saveState()
  return { ok: true, newLevel: s.prestige.level }
}

export function getCurrentSeason() {
  return loadState().season
}

export function getDailyChallenges() {
  const s = loadState()
  const now = Date.now()
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  if (s.challenges.lastDailyReset < dayStart) {
    s.challenges.daily = generateDailyChallenges()
    s.challenges.lastDailyReset = dayStart
    saveState()
  }
  return s.challenges.daily
}

export function getWeeklyChallenges() {
  const s = loadState()
  const now = Date.now()
  const weekStart = now - (now % (7 * 24 * 60 * 60 * 1000))
  if (s.challenges.lastWeeklyReset < weekStart) {
    s.challenges.weekly = generateWeeklyChallenges()
    s.challenges.lastWeeklyReset = weekStart
    saveState()
  }
  return s.challenges.weekly
}

export function getSeasonalChallenges() {
  return loadState().challenges.seasonal.length > 0
    ? loadState().challenges.seasonal
    : CHALLENGE_TEMPLATES.seasonal
}

export function progressChallenge(challengeId, amount, scope = 'daily') {
  const s = loadState()
  const list = scope === 'weekly' ? s.challenges.weekly
    : scope === 'seasonal' ? s.challenges.seasonal
    : s.challenges.daily
  const ch = list.find((c) => c.id === challengeId || c.templateId === challengeId)
  if (!ch) return null
  ch.progress = (ch.progress || 0) + amount
  if (ch.progress >= ch.target && !ch.completed) {
    ch.completed = true
    ch.completedAt = Date.now()
    return { completed: true, xp: ch.xp }
  }
  return { completed: false, progress: ch.progress, target: ch.target }
}

function generateDailyChallenges() {
  const templates = [...CHALLENGE_TEMPLATES.daily]
  const selected = []
  for (let i = 0; i < 3 && templates.length > 0; i++) {
    const idx = Math.floor(Math.random() * templates.length)
    const t = templates.splice(idx, 1)[0]
    selected.push({
      templateId: t.id,
      name: t.name,
      target: t.target,
      xp: t.xp,
      progress: 0,
      completed: false,
      assignedAt: Date.now()
    })
  }
  return selected
}

function generateWeeklyChallenges() {
  const templates = [...CHALLENGE_TEMPLATES.weekly]
  const selected = []
  for (let i = 0; i < 5 && templates.length > 0; i++) {
    const idx = Math.floor(Math.random() * templates.length)
    const t = templates.splice(idx, 1)[0]
    selected.push({
      templateId: t.id,
      name: t.name,
      target: t.target,
      xp: t.xp,
      progress: 0,
      completed: false,
      assignedAt: Date.now()
    })
  }
  return selected
}

export function resetLive() {
  _state = {
    codPoints: 0,
    purchasedItems: [],
    battlePass: { seasonId: 1, tier: 0, xp: 0, premium: false, claimedTiers: [] },
    prestige: { level: 0, icon: 'default', tokens: 0 },
    season: { id: 1, name: 'Season 1', xp: 0 },
    challenges: { daily: [], weekly: [], seasonal: [], lastDailyReset: 0, lastWeeklyReset: 0 }
  }
  saveState()
}
