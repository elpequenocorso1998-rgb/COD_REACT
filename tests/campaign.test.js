import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  MISSIONS,
  DIFFICULTY_LEVELS,
  OBJECTIVE_TYPES,
  getMission,
  getMissionsByAct,
  getFirstMission,
  getNextMission,
  getDifficultyConfig,
  getTotalMissions
} from '../src/game/campaign/missions.js'

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
  getCampaignProgress,
  setDifficulty,
  getDifficulty,
  startMission,
  completeMission,
  isMissionCompleted,
  isMissionUnlocked,
  getMissionStats,
  getCampaignCompletionPct,
  resetCampaign,
  getAllMissionsWithStatus,
  getDifficultyConfigForCurrent
} from '../src/game/campaign/progress.js'

describe('missions.js', () => {
  it('tiene 5 misiones', () => {
    expect(getTotalMissions()).toBe(5)
    expect(MISSIONS.length).toBe(5)
  })

  it('cada misión tiene metadata completa', () => {
    for (const m of MISSIONS) {
      expect(m.id).toBeGreaterThan(0)
      expect(m.name).toBeTruthy()
      expect(m.codename).toBeTruthy()
      expect(m.brief).toBeTruthy()
      expect(m.mapId).toBeTruthy()
      expect(m.difficulty).toBeTruthy()
      expect(m.act).toBeGreaterThan(0)
      expect(m.objectives.length).toBeGreaterThan(0)
      expect(m.enemies).toBeDefined()
      expect(m.winCondition).toBeTruthy()
    }
  })

  it('misiones usan mapas disponibles', () => {
    const validMaps = ['pamplona', 'desert', 'urban', 'snow', 'industrial']
    for (const m of MISSIONS) {
      expect(validMaps).toContain(m.mapId)
    }
  })

  it('cada misión tiene al menos un aliado', () => {
    for (const m of MISSIONS) {
      expect(m.allies.length).toBeGreaterThan(0)
    }
  })

  it('getMission devuelve la misión por id', () => {
    expect(getMission(1).id).toBe(1)
    expect(getMission(999)).toBeNull()
  })

  it('getMissionsByAct filtra por acto', () => {
    expect(getMissionsByAct(1).length).toBe(2)
    expect(getMissionsByAct(2).length).toBe(2)
    expect(getMissionsByAct(3).length).toBe(1)
  })

  it('getFirstMission devuelve la misión 1', () => {
    expect(getFirstMission().id).toBe(1)
  })

  it('getNextMission devuelve la siguiente', () => {
    expect(getNextMission(1).id).toBe(2)
    expect(getNextMission(5)).toBeNull()
  })

  it('DIFFICULTY_LEVELS tiene 4 niveles', () => {
    expect(Object.keys(DIFFICULTY_LEVELS).length).toBe(4)
    expect(DIFFICULTY_LEVELS.recruit).toBeDefined()
    expect(DIFFICULTY_LEVELS.regular).toBeDefined()
    expect(DIFFICULTY_LEVELS.hardened).toBeDefined()
    expect(DIFFICULTY_LEVELS.veteran).toBeDefined()
  })

  it('cada dificultad tiene multiplicadores', () => {
    for (const key in DIFFICULTY_LEVELS) {
      const d = DIFFICULTY_LEVELS[key]
      expect(d.enemyHpMul).toBeGreaterThan(0)
      expect(d.enemyDamageMul).toBeGreaterThan(0)
      expect(d.playerHpMul).toBeGreaterThan(0)
      expect(d.aiAccuracy).toBeGreaterThan(0)
      expect(d.aiAccuracy).toBeLessThanOrEqual(1)
    }
  })

  it('veteran es más difícil que recruit', () => {
    expect(DIFFICULTY_LEVELS.veteran.enemyHpMul).toBeGreaterThan(DIFFICULTY_LEVELS.recruit.enemyHpMul)
    expect(DIFFICULTY_LEVELS.veteran.playerHpMul).toBeLessThan(DIFFICULTY_LEVELS.recruit.playerHpMul)
  })

  it('getDifficultyConfig devuelve config o fallback regular', () => {
    expect(getDifficultyConfig('veteran').name).toBe('Veteran')
    expect(getDifficultyConfig('nonexistent').name).toBe('Regular')
  })

  it('OBJECTIVE_TYPES tiene 8 tipos', () => {
    expect(Object.keys(OBJECTIVE_TYPES).length).toBe(8)
    expect(OBJECTIVE_TYPES.KILL_TARGET).toBe('kill_target')
    expect(OBJECTIVE_TYPES.EXTRACT).toBe('extract')
  })

  it('misión 1 tiene 4 objetivos', () => {
    expect(MISSIONS[0].objectives.length).toBe(4)
  })

  it('misión 5 (final) tiene 4 aliados', () => {
    expect(MISSIONS[4].allies.length).toBe(4)
  })
})

describe('campaign/progress.js', () => {
  beforeEach(() => {
    _localStorage.clear()
    resetCampaign()
  })

  afterEach(() => {
    _localStorage.clear()
  })

  it('getCampaignProgress devuelve estado inicial', () => {
    const p = getCampaignProgress()
    expect(p.completedMissions).toEqual([])
    expect(p.currentMissionId).toBeNull()
    expect(p.difficulty).toBe('regular')
    expect(p.missionStats).toEqual({})
  })

  it('setDifficulty cambia la dificultad', () => {
    setDifficulty('veteran')
    expect(getDifficulty()).toBe('veteran')
  })

  it('startMission marca currentMissionId', () => {
    const m = startMission(1)
    expect(m.id).toBe(1)
    expect(getCampaignProgress().currentMissionId).toBe(1)
  })

  it('completeMission añade a completedMissions', () => {
    completeMission(1, { kills: 10, timeCompleted: 300 })
    expect(isMissionCompleted(1)).toBe(true)
    expect(isMissionCompleted(2)).toBe(false)
  })

  it('completeMission devuelve la siguiente misión', () => {
    const next = completeMission(1)
    expect(next.id).toBe(2)
  })

  it('completeMission devuelve null tras la última', () => {
    const next = completeMission(5)
    expect(next).toBeNull()
  })

  it('isMissionUnlocked: misión 1 siempre unlocked', () => {
    expect(isMissionUnlocked(1)).toBe(true)
  })

  it('isMissionUnlocked: misión 2 bloqueada hasta completar 1', () => {
    expect(isMissionUnlocked(2)).toBe(false)
    completeMission(1)
    expect(isMissionUnlocked(2)).toBe(true)
  })

  it('getMissionStats devuelve stats guardadas', () => {
    completeMission(1, { kills: 15, headshots: 3 })
    const stats = getMissionStats(1)
    expect(stats.kills).toBe(15)
    expect(stats.headshots).toBe(3)
    expect(stats.difficulty).toBe('regular')
  })

  it('getCampaignCompletionPct calcula porcentaje', () => {
    expect(getCampaignCompletionPct()).toBe(0)
    completeMission(1)
    expect(getCampaignCompletionPct()).toBe(20)
    completeMission(2)
    completeMission(3)
    completeMission(4)
    completeMission(5)
    expect(getCampaignCompletionPct()).toBe(100)
  })

  it('resetCampaign limpia todo', () => {
    completeMission(1)
    setDifficulty('veteran')
    resetCampaign()
    expect(getCampaignProgress().completedMissions).toEqual([])
    expect(getCampaignProgress().difficulty).toBe('regular')
  })

  it('getAllMissionsWithStatus devuelve estado por misión', () => {
    completeMission(1)
    const all = getAllMissionsWithStatus()
    expect(all.length).toBe(5)
    expect(all[0].completed).toBe(true)
    expect(all[0].unlocked).toBe(true)
    expect(all[1].completed).toBe(false)
    expect(all[1].unlocked).toBe(true)
    expect(all[2].unlocked).toBe(false)
  })

  it('getDifficultyConfigForCurrent devuelve config de la dificultad activa', () => {
    setDifficulty('hardened')
    expect(getDifficultyConfigForCurrent().name).toBe('Hardened')
  })
})
