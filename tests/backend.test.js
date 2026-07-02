import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const _localStorage = (() => {
  let store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} }
  }
})()

globalThis.localStorage = _localStorage
globalThis.fetch = vi.fn()

import { createApiClient, OAuth_PROVIDERS as OAUTH_PROVIDERS } from '@/game/backend/api-client'
import {
  STORE_ITEMS,
  PRESTIGE_LEVELS,
  SEASON_CONFIG,
  CHALLENGE_TEMPLATES,
  getCodPoints,
  addCodPoints,
  purchaseItem,
  isItemOwned,
  getOwnedItems,
  getBattlePass,
  addBattlePassXP,
  claimBattlePassReward,
  upgradeToPremium,
  purchaseBattlePassBundle,
  getPrestige,
  canPrestige,
  prestige,
  getCurrentSeason,
  getDailyChallenges,
  getWeeklyChallenges,
  getSeasonalChallenges,
  progressChallenge,
  resetLive
} from '@/game/backend/live-service'

describe('api-client.js', () => {
  beforeEach(() => {
    _localStorage.clear()
    fetch.mockReset()
  })

  it('OAuth_PROVIDERS tiene 6 providers', () => {
    expect(Object.keys(OAUTH_PROVIDERS).length).toBe(6)
    expect(OAUTH_PROVIDERS.GOOGLE).toBe('google')
    expect(OAUTH_PROVIDERS.STEAM).toBe('steam')
    expect(OAUTH_PROVIDERS.DISCORD).toBe('discord')
  })

  it('createApiClient devuelve API completa', () => {
    const api = createApiClient()
    expect(typeof api.registerWithEmail).toBe('function')
    expect(typeof api.loginWithEmail).toBe('function')
    expect(typeof api.loginWithOAuth).toBe('function')
    expect(typeof api.logout).toBe('function')
    expect(typeof api.findMatch).toBe('function')
    expect(typeof api.getFriends).toBe('function')
    expect(typeof api.createParty).toBe('function')
    expect(typeof api.trackEvent).toBe('function')
    expect(typeof api.reportPlayer).toBe('function')
  })

  it('isAuthenticated devuelve false sin token', () => {
    const api = createApiClient()
    expect(api.isAuthenticated()).toBe(false)
  })

  it('loginWithEmail guarda token', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'fake_token', user: { id: 1, displayName: 'Test' } })
    })
    const api = createApiClient()
    await api.loginWithEmail('test@test.com', 'password')
    expect(api.isAuthenticated()).toBe(true)
    expect(api.getCurrentUser().displayName).toBe('Test')
  })

  it('logout limpia token', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'fake_token', user: { id: 1 } })
    })
    const api = createApiClient()
    await api.loginWithEmail('test@test.com', 'password')
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    await api.logout()
    expect(api.isAuthenticated()).toBe(false)
  })

  it('findMatch llama al endpoint', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ticketId: 'abc', status: 'searching' })
    })
    const api = createApiClient()
    const result = await api.findMatch({ mode: 'tdm', inputType: 'mnk' })
    expect(result.ticketId).toBe('abc')
  })

  it('trackEvent no crashea sin auth', async () => {
    const api = createApiClient()
    await expect(api.trackEvent('test_event')).resolves.toBeUndefined()
  })
})

describe('live-service.js — store', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetLive()
  })

  afterEach(() => {
    _localStorage.clear()
  })

  it('STORE_ITEMS tiene 11+ items', () => {
    expect(Object.keys(STORE_ITEMS).length).toBeGreaterThanOrEqual(11)
  })

  it('estado inicial: 0 COD Points', () => {
    expect(getCodPoints()).toBe(0)
  })

  it('addCodPoints incrementa', () => {
    addCodPoints(1000)
    expect(getCodPoints()).toBe(1000)
  })

  it('purchaseItem falla sin CP suficientes', () => {
    const r = purchaseItem('blueprint_m4_gold')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('insufficient_cp')
  })

  it('purchaseItem exitoso resta CP', () => {
    addCodPoints(2000)
    const r = purchaseItem('blueprint_m4_gold')
    expect(r.ok).toBe(true)
    expect(getCodPoints()).toBe(800)
    expect(isItemOwned('blueprint_m4_gold')).toBe(true)
  })

  it('purchaseItem falla si ya owned', () => {
    addCodPoints(5000)
    purchaseItem('blueprint_m4_gold')
    const r = purchaseItem('blueprint_m4_gold')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('already_owned')
  })

  it('purchaseItem falla para item inexistente', () => {
    const r = purchaseItem('nonexistent')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('not_found')
  })

  it('getOwnedItems devuelve lista', () => {
    addCodPoints(5000)
    purchaseItem('blueprint_m4_gold')
    purchaseItem('operator_ghost')
    expect(getOwnedItems().length).toBe(2)
  })
})

describe('live-service.js — battle pass', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetLive()
  })

  it('estado inicial: tier 0, no premium', () => {
    const bp = getBattlePass()
    expect(bp.tier).toBe(0)
    expect(bp.premium).toBe(false)
  })

  it('addBattlePassXP sube tiers', () => {
    addBattlePassXP(1000)
    expect(getBattlePass().tier).toBe(1)
  })

  it('addBattlePassXP respeta max 100 tiers', () => {
    addBattlePassXP(1000 * 200)
    expect(getBattlePass().tier).toBe(100)
  })

  it('claimBattlePassReward falla sin premium en tier no-múltiplo-5', () => {
    addBattlePassXP(1000)
    const r = claimBattlePassReward(1)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('premium_required')
  })

  it('claimBattlePassReward permite tier múltiplo-5 sin premium', () => {
    addBattlePassXP(1000 * 5)
    const r = claimBattlePassReward(5)
    expect(r.ok).toBe(true)
  })

  it('upgradeToPremium resta CP', () => {
    addCodPoints(1000)
    const r = upgradeToPremium()
    expect(r.ok).toBe(true)
    expect(getCodPoints()).toBe(0)
    expect(getBattlePass().premium).toBe(true)
  })

  it('purchaseBattlePassBundle da premium + 20 tiers', () => {
    addCodPoints(2400)
    const r = purchaseBattlePassBundle()
    expect(r.ok).toBe(true)
    expect(getBattlePass().premium).toBe(true)
    expect(getBattlePass().tier).toBe(20)
  })
})

describe('live-service.js — prestige', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetLive()
  })

  it('PRESTIGE_LEVELS tiene 11 niveles', () => {
    expect(PRESTIGE_LEVELS.length).toBe(11)
  })

  it('estado inicial: prestige 0', () => {
    expect(getPrestige().level).toBe(0)
  })

  it('canPrestige requiere nivel 55', () => {
    expect(canPrestige(50)).toBe(false)
    expect(canPrestige(55)).toBe(true)
  })

  it('canPrestige false en prestige max (10)', () => {
    for (let i = 0; i < 10; i++) prestige()
    expect(canPrestige(55)).toBe(false)
  })

  it('prestige incrementa nivel y da token', () => {
    const r = prestige()
    expect(r.ok).toBe(true)
    expect(getPrestige().level).toBe(1)
    expect(getPrestige().tokens).toBe(1)
  })

  it('prestige falla en max', () => {
    for (let i = 0; i < 10; i++) prestige()
    const r = prestige()
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('max_prestige')
  })
})

describe('live-service.js — challenges', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetLive()
  })

  it('CHALLENGE_TEMPLATES tiene 4 scopes', () => {
    expect(Object.keys(CHALLENGE_TEMPLATES).length).toBe(4)
    expect(CHALLENGE_TEMPLATES.daily.length).toBeGreaterThanOrEqual(6)
    expect(CHALLENGE_TEMPLATES.weekly.length).toBeGreaterThanOrEqual(5)
    expect(CHALLENGE_TEMPLATES.seasonal.length).toBeGreaterThanOrEqual(3)
    expect(CHALLENGE_TEMPLATES.weapon.length).toBeGreaterThanOrEqual(6)
  })

  it('getDailyChallenges devuelve 3 challenges', () => {
    const daily = getDailyChallenges()
    expect(daily.length).toBe(3)
    expect(daily[0].target).toBeGreaterThan(0)
  })

  it('getWeeklyChallenges devuelve 5 challenges', () => {
    const weekly = getWeeklyChallenges()
    expect(weekly.length).toBe(5)
  })

  it('getSeasonalChallenges devuelve 3+', () => {
    const seasonal = getSeasonalChallenges()
    expect(seasonal.length).toBeGreaterThanOrEqual(3)
  })

  it('progressChallenge incrementa progreso', () => {
    getDailyChallenges()
    const ch = getDailyChallenges()[0]
    const r = progressChallenge(ch.templateId, 1)
    if (!r.completed) {
      expect(r.progress).toBe(1)
    } else {
      expect(ch.target).toBe(1)
    }
  })

  it('progressChallenge completa al alcanzar target', () => {
    getDailyChallenges()
    const ch = getDailyChallenges()[0]
    const r = progressChallenge(ch.templateId, ch.target)
    expect(r.completed).toBe(true)
    expect(r.xp).toBeGreaterThan(0)
  })
})

describe('live-service.js — season', () => {
  it('SEASON_CONFIG tiene duración 90 días y 100 tiers', () => {
    expect(SEASON_CONFIG.duration).toBe(90)
    expect(SEASON_CONFIG.tiers).toBe(100)
  })

  it('getCurrentSeason devuelve info', () => {
    const s = getCurrentSeason()
    expect(s.id).toBe(1)
    expect(s.name).toBeTruthy()
  })
})
