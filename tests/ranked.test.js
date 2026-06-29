import { describe, it, expect, beforeEach, afterEach } from 'vitest'

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

import {
  CDL_RULESET,
  TIERS,
  SR_CONFIG,
  getTierForSR,
  getRankedStats,
  getSR,
  isPlacementsComplete,
  getPlacementMatchesRemaining,
  recordMatch,
  applyWeeklyDecay,
  getStreak,
  getWinRate,
  getRewardsForTier,
  resetRanked,
  isWeaponBanned,
  isAttachmentBanned,
  isPerkBanned,
  isFieldUpgradeBanned
} from '../src/game/competitive/ranked.js'

describe('ranked.js — CDL ruleset', () => {
  it('CDL_RULESET tiene 3 modos y 4 mapas', () => {
    expect(CDL_RULESET.modes.length).toBe(3)
    expect(CDL_RULESET.maps.length).toBe(4)
    expect(CDL_RULESET.teamSize).toBe(4)
    expect(CDL_RULESET.bestOf).toBe(11)
  })

  it('CDL banea RPG, PILA, Deagle', () => {
    expect(isWeaponBanned('rpg')).toBe(true)
    expect(isWeaponBanned('pila')).toBe(true)
    expect(isWeaponBanned('deagle')).toBe(true)
    expect(isWeaponBanned('m4')).toBe(false)
  })

  it('CDL banea grenadeLauncher, thermal, drumMag', () => {
    expect(isAttachmentBanned('grenadeLauncher')).toBe(true)
    expect(isAttachmentBanned('thermal')).toBe(true)
    expect(isAttachmentBanned('drumMag')).toBe(true)
    expect(isAttachmentBanned('reddot')).toBe(false)
  })

  it('CDL banea juggernaut y stoppingPower', () => {
    expect(isPerkBanned('juggernaut')).toBe(true)
    expect(isPerkBanned('stoppingPower')).toBe(true)
    expect(isPerkBanned('marathon')).toBe(false)
  })

  it('CDL banea EMP y reconTower', () => {
    expect(isFieldUpgradeBanned('emp')).toBe(true)
    expect(isFieldUpgradeBanned('reconTower')).toBe(true)
    expect(isFieldUpgradeBanned('trophySystem')).toBe(false)
  })

  it('CDL settings: friendly fire, sin minimap, sin scorestreaks', () => {
    expect(CDL_RULESET.settings.friendlyFire).toBe(true)
    expect(CDL_RULESET.settings.miniMap).toBe(false)
    expect(CDL_RULESET.settings.scorestreaks).toBe(false)
  })
})

describe('ranked.js — tiers', () => {
  it('tiene 8 tiers', () => {
    expect(TIERS.length).toBe(8)
  })

  it('tiers ordenados por SR ascendente', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].minSR).toBeGreaterThan(TIERS[i - 1].minSR)
    }
  })

  it('getTierForSR devuelve tier correcto', () => {
    expect(getTierForSR(0).id).toBe('bronze')
    expect(getTierForSR(1500).id).toBe('silver')
    expect(getTierForSR(3000).id).toBe('gold')
    expect(getTierForSR(6000).id).toBe('diamond')
    expect(getTierForSR(11000).id).toBe('top250')
  })

  it('getTierForSR hace fallback a bronze', () => {
    expect(getTierForSR(-100).id).toBe('bronze')
  })
})

describe('ranked.js — SR progression', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetRanked()
  })

  afterEach(() => {
    _localStorage.clear()
  })

  it('estado inicial: 0 SR, bronze, 0 placements', () => {
    const s = getRankedStats()
    expect(s.sr).toBe(0)
    expect(s.tier).toBe('bronze')
    expect(s.placementsComplete).toBe(false)
    expect(getPlacementMatchesRemaining()).toBe(SR_CONFIG.PLACEMENT_MATCHES)
  })

  it('recordMatch durante placements da SR base', () => {
    const r = recordMatch({ won: true, opponentAvgSR: 0 })
    expect(r.srAfter).toBeGreaterThan(r.srBefore)
    expect(getPlacementMatchesRemaining()).toBe(SR_CONFIG.PLACEMENT_MATCHES - 1)
  })

  it('placements completos tras 10 matches', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true, opponentAvgSR: 0 })
    }
    expect(isPlacementsComplete()).toBe(true)
    expect(getPlacementMatchesRemaining()).toBe(0)
  })

  it('win incrementa wins y streak positivo', () => {
    recordMatch({ won: true })
    recordMatch({ won: true })
    const s = getRankedStats()
    expect(s.wins).toBe(2)
    expect(s.streak).toBe(2)
  })

  it('loss incrementa losses y streak negativo', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    recordMatch({ won: false, opponentAvgSR: 0 })
    const s = getRankedStats()
    expect(s.losses).toBe(1)
    expect(s.streak).toBe(-1)
  })

  it('MVP bonus añade SR extra', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    const srBefore = getSR()
    recordMatch({ won: true, mvp: true, opponentAvgSR: 0 })
    const srAfter = getSR()
    expect(srAfter).toBeGreaterThan(srBefore)
  })

  it('quit penalty aplica', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    const srBefore = getSR()
    recordMatch({ won: false, quit: true, opponentAvgSR: 0 })
    const srAfter = getSR()
    expect(srAfter).toBeLessThan(srBefore)
  })

  it('getStreak devuelve racha actual', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    recordMatch({ won: true, opponentAvgSR: 0 })
    expect(getStreak()).toBeGreaterThan(0)
  })

  it('getWinRate calcula ratio', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    recordMatch({ won: false, opponentAvgSR: 0 })
    expect(getWinRate()).toBeCloseTo(10 / 11, 1)
  })

  it('resetRanked limpia todo', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    resetRanked()
    expect(getSR()).toBe(0)
    expect(isPlacementsComplete()).toBe(false)
  })

  it('getRewardsForTier devuelve rewards', () => {
    expect(getRewardsForTier('gold').xp).toBe(5000)
    expect(getRewardsForTier('gold').weaponCamo).toBe('gold')
    expect(getRewardsForTier('top250').charm).toBe('champion')
  })

  it('applyWeeklyDecay no aplica bajo threshold', () => {
    for (let i = 0; i < SR_CONFIG.PLACEMENT_MATCHES; i++) {
      recordMatch({ won: true })
    }
    expect(applyWeeklyDecay()).toBe(0)
  })
})
