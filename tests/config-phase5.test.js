import { describe, it, expect } from 'vitest'
import {
  WEAPONS,
  WEAPON_PLATFORMS,
  ATTACHMENTS,
  ATTACHMENT_SLOTS,
  FIELD_UPGRADES,
  GRENADE_TYPES,
  DEFAULT_LOADOUT
} from '@/game/core/config'

describe('Phase 5 — arsenal expandido', () => {
  it('tiene 28+ armas (7 originales + 21 nuevas)', () => {
    const count = Object.keys(WEAPONS).length
    expect(count).toBeGreaterThanOrEqual(28)
  })

  it('categorías cubren ar/smg/sniper/shotgun/lmg/pistol/marksman/launcher', () => {
    const categories = new Set(Object.values(WEAPONS).map(w => w.category))
    expect(categories.has('ar')).toBe(true)
    expect(categories.has('smg')).toBe(true)
    expect(categories.has('sniper')).toBe(true)
    expect(categories.has('shotgun')).toBe(true)
    expect(categories.has('lmg')).toBe(true)
    expect(categories.has('pistol')).toBe(true)
    expect(categories.has('marksman')).toBe(true)
    expect(categories.has('launcher')).toBe(true)
  })

  it('armas nuevas tienen stats válidas', () => {
    const newWeapons = ['kilo141', 'grau', 'fr556', 'oden', 'mp7', 'p90', 'uzi', 'aug',
      'm91', 'pkm', 'model680', 'r90', 'hdr', 'ax50', 'ebr14', 'mk2', 'kar98k',
      'x16', 'deagle', 'rpg', 'pila']
    for (const id of newWeapons) {
      const w = WEAPONS[id]
      expect(w, `weapon ${id}`).toBeDefined()
      expect(w.id).toBe(id)
      expect(w.category).toBeTruthy()
      expect(w.magSize).toBeGreaterThan(0)
      expect(w.bodyDamage).toBeGreaterThan(0)
      expect(w.fireInterval).toBeGreaterThan(0)
      expect(w.reloadTime).toBeGreaterThan(0)
    }
  })

  it('FR 5.56 es burst (3)', () => {
    expect(WEAPONS.fr556.burst).toBe(3)
  })

  it('RPG y PILA son launchers con projectile:true', () => {
    expect(WEAPONS.rpg.category).toBe('launcher')
    expect(WEAPONS.rpg.projectile).toBe(true)
    expect(WEAPONS.rpg.explosionRadius).toBeGreaterThan(0)
    expect(WEAPONS.pila.category).toBe('launcher')
    expect(WEAPONS.pila.projectile).toBe(true)
    expect(WEAPONS.pila.lockOn).toBe(true)
  })

  it('R9-0 dispara burst de 2 con 10 pellets', () => {
    expect(WEAPONS.r90.burst).toBe(2)
    expect(WEAPONS.r90.pellets).toBe(10)
  })

  it('WEAPON_PLATFORMS define platforms con members', () => {
    const platforms = Object.keys(WEAPON_PLATFORMS)
    expect(platforms.length).toBeGreaterThanOrEqual(10)
    for (const key of platforms) {
      const p = WEAPON_PLATFORMS[key]
      expect(p.members.length).toBeGreaterThan(0)
      expect(p.receiver).toBeTruthy()
    }
  })

  it('M4 platform incluye m4, kilo141, grau, fr556', () => {
    expect(WEAPON_PLATFORMS.ar_m4.members).toEqual(['m4', 'kilo141', 'grau', 'fr556'])
  })
})

describe('Phase 5 — attachments expandidos', () => {
  it('tiene 30+ attachments', () => {
    const count = Object.keys(ATTACHMENTS).length
    expect(count).toBeGreaterThanOrEqual(30)
  })

  it('ATTACHMENT_SLOTS incluye perk slot', () => {
    expect(ATTACHMENT_SLOTS).toContain('perk')
    expect(ATTACHMENT_SLOTS).toContain('sight')
    expect(ATTACHMENT_SLOTS).toContain('barrel')
    expect(ATTACHMENT_SLOTS).toContain('underbarrel')
    expect(ATTACHMENT_SLOTS).toContain('mag')
    expect(ATTACHMENT_SLOTS).toContain('stock')
  })

  it('attachments nuevos tienen slots válidos', () => {
    const newOnes = ['vlk', 'cronen', 'sniperScope', 'thermal', 'muzzleBrake',
      'flashGuard', 'longBarrel', 'shortBarrel', 'tacLaser', 'bipod',
      'grenadeLauncher', 'fastMag', 'drumMag', 'noStock', 'heavyStock',
      'rubberized', 'perkSleightOfHand', 'perkFrangible', 'perkBurst']
    for (const id of newOnes) {
      const a = ATTACHMENTS[id]
      expect(a, `attachment ${id}`).toBeDefined()
      expect(ATTACHMENT_SLOTS).toContain(a.slot)
    }
  })

  it('perkBurst añade burst:3', () => {
    expect(ATTACHMENTS.perkBurst.burst).toBe(3)
  })

  it('thermal marca flag thermal', () => {
    expect(ATTACHMENTS.thermal.thermal).toBe(true)
  })

  it('grenadeLauncher tiene secondaryFire', () => {
    expect(ATTACHMENTS.grenadeLauncher.secondaryFire).toBe('frag')
  })
})

describe('Phase 5 — field upgrades', () => {
  it('tiene 8 field upgrades', () => {
    const count = Object.keys(FIELD_UPGRADES).length
    expect(count).toBe(8)
  })

  it('cada FU tiene cooldown, duration y desc', () => {
    for (const id in FIELD_UPGRADES) {
      const fu = FIELD_UPGRADES[id]
      expect(fu.id).toBe(id)
      expect(fu.cooldown).toBeGreaterThan(0)
      expect(fu.duration).toBeGreaterThan(0)
      expect(fu.desc).toBeTruthy()
    }
  })

  it('trophySystem tiene charges:3 y radius:8', () => {
    expect(FIELD_UPGRADES.trophySystem.charges).toBe(3)
    expect(FIELD_UPGRADES.trophySystem.radius).toBe(8)
  })

  it('deadSilenceField es teamWide', () => {
    expect(FIELD_UPGRADES.deadSilenceField.teamWide).toBe(true)
  })
})

describe('Phase 5 — grenade types', () => {
  it('tiene 15 grenade types', () => {
    const count = Object.keys(GRENADE_TYPES.tactical).length
    expect(count).toBeGreaterThanOrEqual(15)
  })

  it('semtex es sticky', () => {
    expect(GRENADE_TYPES.tactical.semtex.sticky).toBe(true)
  })

  it('c4 es remote detonation', () => {
    expect(GRENADE_TYPES.tactical.c4.remote).toBe(true)
    expect(GRENADE_TYPES.tactical.c4.fuse).toBe(0)
  })

  it('claymore es trigger proximity', () => {
    expect(GRENADE_TYPES.tactical.claymore.trigger).toBe('proximity')
  })

  it('stim heal sin daño', () => {
    expect(GRENADE_TYPES.tactical.stim.effect).toBe('heal')
    expect(GRENADE_TYPES.tactical.stim.damage).toBe(0)
    expect(GRENADE_TYPES.tactical.stim.healAmount).toBe(50)
  })
})

describe('Phase 5 — DEFAULT_LOADOUT', () => {
  it('incluye fieldUpgrade', () => {
    expect(DEFAULT_LOADOUT.fieldUpgrade).toBe('trophySystem')
  })

  it('incluye secondaryAttachments', () => {
    expect(DEFAULT_LOADOUT.secondaryAttachments).toBeDefined()
  })

  it('tactical/lethal están en orden correcto (flash=tactical, frag=lethal)', () => {
    expect(DEFAULT_LOADOUT.tactical).toBe('flash')
    expect(DEFAULT_LOADOUT.lethal).toBe('frag')
  })
})
