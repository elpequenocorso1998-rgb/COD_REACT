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

import {
  getLoadout,
  saveLoadout,
  setLoadout,
  getCustomClasses,
  saveCustomClasses,
  getActiveClassIndex,
  setActiveClassIndex,
  duplicateClass,
  resetClass,
  getMaxClasses,
  getFieldUpgrade,
  applyLoadoutToWeapon,
  resetLoadout
} from '@/game/player/loadout'
import { WEAPONS } from '@/game/core/config'

describe('Phase 5 — custom classes', () => {
  beforeEach(() => {
    _localStorage.clear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('getMaxClasses devuelve 10', () => {
    expect(getMaxClasses()).toBe(10)
  })

  it('getCustomClasses inicializa 10 slots con default en 0', () => {
    const classes = getCustomClasses()
    expect(classes.length).toBe(10)
    expect(classes[0]).toBeTruthy()
    expect(classes[1]).toBeNull()
  })

  it('setActiveClassIndex cambia el slot activo y carga el loadout', () => {
    setActiveClassIndex(2)
    expect(getActiveClassIndex()).toBe(2)
    const l = getLoadout()
    expect(l).toBeTruthy()
  })

  it('setActiveClassIndex ignora idx fuera de rango', () => {
    setActiveClassIndex(0)
    setActiveClassIndex(99)
    expect(getActiveClassIndex()).toBe(0)
    setActiveClassIndex(-1)
    expect(getActiveClassIndex()).toBe(0)
  })

  it('duplicateClass copia un slot a otro', () => {
    const classes = getCustomClasses()
    classes[1] = { ...classes[0], primary: 'ak47' }
    saveCustomClasses(classes)
    duplicateClass(1, 3)
    const updated = getCustomClasses()
    expect(updated[3].primary).toBe('ak47')
  })

  it('resetClass restaura default en el slot', () => {
    const classes = getCustomClasses()
    classes[2] = { ...classes[0], primary: 'sniper' }
    saveCustomClasses(classes)
    resetClass(2)
    const updated = getCustomClasses()
    expect(updated[2].primary).toBe('m4')
  })

  it('setLoadout persiste en el slot activo', () => {
    setActiveClassIndex(0)
    const l = getLoadout()
    l.primary = 'mp5'
    setLoadout(l)
    const classes = getCustomClasses()
    expect(classes[0].primary).toBe('mp5')
  })
})

describe('Phase 5 — field upgrade en loadout', () => {
  beforeEach(() => {
    _localStorage.clear()
  })

  it('getFieldUpgrade devuelve el FU del loadout', () => {
    const l = getLoadout()
    l.fieldUpgrade = 'emp'
    saveLoadout(l)
    const fu = getFieldUpgrade(l)
    expect(fu.id).toBe('emp')
  })

  it('getFieldUpgrade devuelve null si no hay', () => {
    const l = getLoadout()
    delete l.fieldUpgrade
    expect(getFieldUpgrade(l)).toBeNull()
  })
})

describe('Phase 5 — secondary attachments', () => {
  beforeEach(() => {
    _localStorage.clear()
  })

  it('applyLoadoutToWeapon aplica secondaryAttachments al secondary', () => {
    const l = getLoadout()
    l.secondary = 'x16'
    l.secondaryAttachments = { sight: 'reddot' }
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('x16', l)
    expect(effective.adsSpread).toBeLessThan(WEAPONS.x16.adsSpread)
  })

  it('applyLoadoutToWeapon no aplica attachments a un arma que no es primary ni secondary', () => {
    const l = getLoadout()
    l.primary = 'm4'
    l.primaryAttachments = { sight: 'reddot' }
    l.secondary = 'pistol'
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('ak47', l)
    expect(effective.adsSpread).toBe(WEAPONS.ak47.adsSpread)
  })
})

describe('Phase 5 — nuevos attachments aplicados', () => {
  beforeEach(() => {
    _localStorage.clear()
  })

  it('perkBurst añade burst:3 al arma', () => {
    const l = getLoadout()
    l.primary = 'm4'
    l.primaryAttachments = { perk: 'perkBurst' }
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('m4', l)
    expect(effective.burst).toBe(3)
  })

  it('fastMag reduce reloadTime', () => {
    const l = getLoadout()
    l.primary = 'm4'
    l.primaryAttachments = { mag: 'fastMag' }
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('m4', l)
    expect(effective.reloadTime).toBeLessThan(WEAPONS.m4.reloadTime)
  })

  it('drumMag dobla magSize', () => {
    const l = getLoadout()
    l.primary = 'm4'
    l.primaryAttachments = { mag: 'drumMag' }
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('m4', l)
    expect(effective.magSize).toBeGreaterThanOrEqual(WEAPONS.m4.magSize * 1.9)
  })

  it('longBarrel aumenta raycastFar', () => {
    const l = getLoadout()
    l.primary = 'm4'
    l.primaryAttachments = { barrel: 'longBarrel' }
    saveLoadout(l)
    const effective = applyLoadoutToWeapon('m4', l)
    expect(effective.raycastFar).toBeGreaterThan(WEAPONS.m4.raycastFar)
  })

  it('resetLoadout limpia primary y secondary attachments', () => {
    const l = getLoadout()
    l.primaryAttachments = { sight: 'reddot' }
    l.secondaryAttachments = { sight: 'acog' }
    saveLoadout(l)
    resetLoadout()
    const reset = getLoadout()
    expect(reset.primaryAttachments).toEqual({})
    expect(reset.secondaryAttachments).toEqual({})
  })
})
