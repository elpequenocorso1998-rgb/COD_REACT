import { describe, it, expect } from 'vitest'
import {
  GAME_MODES,
  PVP_MODES,
  PVE_MODES,
  getGameMode,
  getDefaultPvPMode,
  getDefaultPvEMode,
  isPvP,
  isPvE,
  getTeamCount,
  getMaxPlayers
} from '@/game/modes/index'

describe('modes/index.js', () => {
  it('tiene 14 modos de juego', () => {
    expect(Object.keys(GAME_MODES).length).toBe(14)
  })

  it('incluye survival, campaign, tdm, ffa, domination, hardpoint, warzone', () => {
    expect(GAME_MODES.survival).toBeDefined()
    expect(GAME_MODES.campaign).toBeDefined()
    expect(GAME_MODES.tdm).toBeDefined()
    expect(GAME_MODES.ffa).toBeDefined()
    expect(GAME_MODES.domination).toBeDefined()
    expect(GAME_MODES.hardpoint).toBeDefined()
    expect(GAME_MODES.warzone).toBeDefined()
  })

  it('cada modo tiene metadata completa', () => {
    for (const id in GAME_MODES) {
      const m = GAME_MODES[id]
      expect(m.id).toBe(id)
      expect(m.name).toBeTruthy()
      expect(m.desc).toBeTruthy()
      expect(m.type).toMatch(/^(pve|pvp)$/)
      expect(m.maxPlayers).toBeGreaterThan(0)
    }
  })

  it('PVP_MODES incluye tdm, ffa, warzone', () => {
    expect(PVP_MODES).toContain('tdm')
    expect(PVP_MODES).toContain('ffa')
    expect(PVP_MODES).toContain('warzone')
    expect(PVP_MODES).not.toContain('survival')
  })

  it('PVE_MODES incluye survival y campaign', () => {
    expect(PVE_MODES).toContain('survival')
    expect(PVE_MODES).toContain('campaign')
    expect(PVE_MODES).not.toContain('tdm')
  })

  it('getGameMode devuelve modo o null', () => {
    expect(getGameMode('tdm').id).toBe('tdm')
    expect(getGameMode('nonexistent')).toBeNull()
  })

  it('getDefaultPvPMode devuelve tdm', () => {
    expect(getDefaultPvPMode()).toBe('tdm')
  })

  it('getDefaultPvEMode devuelve survival', () => {
    expect(getDefaultPvEMode()).toBe('survival')
  })

  it('isPvP / isPvE clasifican correctamente', () => {
    expect(isPvP('tdm')).toBe(true)
    expect(isPvP('survival')).toBe(false)
    expect(isPvE('survival')).toBe(true)
    expect(isPvE('tdm')).toBe(false)
  })

  it('getTeamCount devuelve número de equipos', () => {
    expect(getTeamCount('tdm')).toBe(2)
    expect(getTeamCount('ffa')).toBe(0)
    expect(getTeamCount('survival')).toBe(0)
  })

  it('getMaxPlayers devuelve aforo', () => {
    expect(getMaxPlayers('tdm')).toBe(12)
    expect(getMaxPlayers('ffa')).toBe(8)
    expect(getMaxPlayers('groundWar')).toBe(64)
    expect(getMaxPlayers('warzone')).toBe(100)
  })

  it('warzone tiene gulag y contraction', () => {
    expect(GAME_MODES.warzone.hasGulag).toBe(true)
    expect(GAME_MODES.warzone.contraction).toBe(true)
  })

  it('hardpoint tiene objective rotatorio', () => {
    expect(GAME_MODES.hardpoint.objectiveRotates).toBe(true)
    expect(GAME_MODES.hardpoint.objectiveRotationTime).toBe(60)
  })

  it('gunGame tiene weapon progression', () => {
    expect(GAME_MODES.gunGame.weaponProgression).toBe(true)
  })

  it('searchDestroy es best-of-11 con rounds', () => {
    expect(GAME_MODES.searchDestroy.rounds).toBe(true)
    expect(GAME_MODES.searchDestroy.bestOf).toBe(11)
    expect(GAME_MODES.searchDestroy.respawn).toBe(false)
  })

  it('gunfight es 2v2 con round time 40s', () => {
    expect(GAME_MODES.gunfight.maxPlayers).toBe(4)
    expect(GAME_MODES.gunfight.roundTime).toBe(40)
    expect(GAME_MODES.gunfight.overtimeCapture).toBe(true)
  })

  it('hardcore tiene 30 HP y no HUD', () => {
    expect(GAME_MODES.hardcore.playerHP).toBe(30)
    expect(GAME_MODES.hardcore.noHUD).toBe(true)
    expect(GAME_MODES.hardcore.friendlyFire).toBe(true)
  })

  it('infected es asimétrico', () => {
    expect(GAME_MODES.infected.asymmetrical).toBe(true)
    expect(GAME_MODES.infected.winCondition).toBe('last_survivor')
  })

  it('groundWar tiene vehicles', () => {
    expect(GAME_MODES.groundWar.vehicles).toBe(true)
    expect(GAME_MODES.groundWar.maxPlayers).toBe(64)
  })

  it('domination tiene 3 objectives A/B/C', () => {
    expect(GAME_MODES.domination.objectives).toEqual(['A', 'B', 'C'])
  })
})
