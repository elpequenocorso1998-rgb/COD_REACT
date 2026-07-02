import { describe, it, expect, beforeEach } from 'vitest'
import { getLoadout, saveLoadout, applyLoadoutToWeapon, getEffectiveMaxHealth, hasPerk, resetLoadout } from '@/game/player/loadout'
import { WEAPONS } from '@/game/core/config'

describe('loadout', () => {
  beforeEach(() => {
    localStorage.clear()
    resetLoadout()
  })

  it('devuelve loadout por defecto', () => {
    const l = getLoadout()
    expect(l.primary).toBe('m4')
    expect(l.secondary).toBe('pistol')
    expect(l.perks.blue).toBeTruthy()
    expect(l.perks.red).toBeTruthy()
    expect(l.perks.green).toBeTruthy()
  })

  it('saveLoadout persiste', () => {
    saveLoadout({ primary: 'ak47', secondary: 'sniper' })
    const l = getLoadout()
    expect(l.primary).toBe('ak47')
    expect(l.secondary).toBe('sniper')
  })

  it('applyLoadoutToWeapon devuelve stats del arma modificados por perks', () => {
    // Con Stopping Power (damageMul 1.25) el daño debe ser 25% mayor.
    saveLoadout({
      primary: 'm4',
      primaryAttachments: {},
      perks: { blue: 'sleightOfHand', red: 'stoppingPower', green: 'deadSilence' }
    })
    const base = WEAPONS.m4
    const effective = applyLoadoutToWeapon('m4')
    expect(effective.bodyDamage).toBeGreaterThan(base.bodyDamage)
    // 25% más: 34 * 1.25 = 42
    expect(effective.bodyDamage).toBe(42)
  })

  it('Sleight of Hand reduce reloadTime a la mitad', () => {
    saveLoadout({
      primary: 'm4',
      primaryAttachments: {},
      perks: { blue: 'sleightOfHand', red: 'stoppingPower', green: 'deadSilence' }
    })
    const base = WEAPONS.m4
    const effective = applyLoadoutToWeapon('m4')
    expect(effective.reloadTime).toBeCloseTo(base.reloadTime * 0.5, 2)
  })

  it('Extended Mags aumenta magSize', () => {
    saveLoadout({
      primary: 'm4',
      primaryAttachments: { mag: 'extendedmags' },
      perks: { blue: 'sleightOfHand', red: 'stoppingPower', green: 'deadSilence' }
    })
    const effective = applyLoadoutToWeapon('m4')
    // 30 * 1.5 = 45
    expect(effective.magSize).toBe(45)
  })

  it('Juggernaut añade 50 HP', () => {
    saveLoadout({
      primary: 'm4',
      primaryAttachments: {},
      perks: { blue: 'juggernaut', red: 'stoppingPower', green: 'deadSilence' }
    })
    const maxHp = getEffectiveMaxHealth()
    expect(maxHp).toBe(150)
  })

  it('hasPerk detecta perks equipados', () => {
    saveLoadout({
      primary: 'm4',
      primaryAttachments: {},
      perks: { blue: 'marathon', red: 'stoppingPower', green: 'deadSilence' }
    })
    expect(hasPerk('marathon')).toBe(true)
    expect(hasPerk('juggernaut')).toBe(false)
  })

  it('sin perks, el daño es el base', () => {
    saveLoadout({
      primary: 'm4',
      primaryAttachments: {},
      perks: {}
    })
    const effective = applyLoadoutToWeapon('m4')
    expect(effective.bodyDamage).toBe(WEAPONS.m4.bodyDamage)
  })
})
