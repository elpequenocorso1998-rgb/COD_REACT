import { WEAPONS, PERKS, ATTACHMENTS, DEFAULT_LOADOUT, PLAYER, FIELD_UPGRADES } from './config.js'

/* =========================================================================
   Loadout — sistema de create-a-class.
   --------------------------------------------------------------------------
   Gestiona el loadout del jugador (primary, secondary, tactical, lethal,
   perks, attachments, field upgrade). Aplica los efectos de perks y
   attachments al equipar un arma, devolviendo un "weaponDef efectivo" con
   los stats modificados.

   Persistencia: se guarda en localStorage via progression.js.
   Soporta múltiples custom classes (10 slots).
   ========================================================================= */

const LOADOUT_KEY = 'mw_loadout_v1'
const CLASSES_KEY = 'mw_classes_v1'
const MAX_CLASSES = 10

let _loadout = null
let _classes = null
let _activeClassIdx = 0

export function getLoadout() {
  if (_loadout) return _loadout
  try {
    const raw = localStorage.getItem(LOADOUT_KEY)
    if (raw) _loadout = JSON.parse(raw)
  } catch (e) { _loadout = null }
  if (!_loadout) _loadout = { ...DEFAULT_LOADOUT }
  return _loadout
}

export function saveLoadout(loadout) {
  _loadout = loadout
  try {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout))
  } catch (e) { /* localStorage puede no estar disponible */ }
}

export function setLoadout(loadout) {
  saveLoadout(loadout)
  const classes = getCustomClasses()
  classes[_activeClassIdx] = loadout
  saveCustomClasses(classes)
}

export function getCustomClasses() {
  if (_classes) return _classes
  try {
    const raw = localStorage.getItem(CLASSES_KEY)
    if (raw) _classes = JSON.parse(raw)
  } catch (e) { _classes = null }
  if (!_classes || !Array.isArray(_classes)) {
    _classes = Array.from({ length: MAX_CLASSES }, (_, i) =>
      i === 0 ? { ...DEFAULT_LOADOUT } : null
    )
  }
  while (_classes.length < MAX_CLASSES) _classes.push(null)
  return _classes
}

export function saveCustomClasses(classes) {
  _classes = classes
  try {
    localStorage.setItem(CLASSES_KEY, JSON.stringify(classes))
  } catch (e) { /* noop */ }
}

export function getActiveClassIndex() {
  return _activeClassIdx
}

export function setActiveClassIndex(idx) {
  if (idx < 0 || idx >= MAX_CLASSES) return
  _activeClassIdx = idx
  const classes = getCustomClasses()
  if (classes[idx]) {
    saveLoadout(classes[idx])
  } else {
    const fresh = { ...DEFAULT_LOADOUT }
    classes[idx] = fresh
    saveCustomClasses(classes)
    saveLoadout(fresh)
  }
}

export function duplicateClass(fromIdx, toIdx) {
  if (fromIdx < 0 || fromIdx >= MAX_CLASSES) return
  if (toIdx < 0 || toIdx >= MAX_CLASSES) return
  const classes = getCustomClasses()
  const src = classes[fromIdx] || { ...DEFAULT_LOADOUT }
  classes[toIdx] = { ...src, primaryAttachments: { ...src.primaryAttachments } }
  saveCustomClasses(classes)
}

export function resetClass(idx) {
  if (idx < 0 || idx >= MAX_CLASSES) return
  const classes = getCustomClasses()
  classes[idx] = { ...DEFAULT_LOADOUT, primaryAttachments: {} }
  saveCustomClasses(classes)
  if (idx === _activeClassIdx) saveLoadout(classes[idx])
}

export function getMaxClasses() {
  return MAX_CLASSES
}

export function getFieldUpgrade(loadout = getLoadout()) {
  const fuId = loadout.fieldUpgrade
  if (!fuId) return null
  return FIELD_UPGRADES[fuId] || null
}

export function applyLoadoutToWeapon(weaponId, loadout = getLoadout(), playerState = null) {
  const base = WEAPONS[weaponId]
  if (!base) return WEAPONS.m4

  const effective = { ...base }

  const attachmentsMap = (weaponId === loadout.primary)
    ? loadout.primaryAttachments
    : (weaponId === loadout.secondary ? loadout.secondaryAttachments : {})
  for (const slot in attachmentsMap) {
    const attId = attachmentsMap[slot]
    const att = ATTACHMENTS[attId]
    if (!att) continue
    // Fase 18.9: bipod requiere crouch/prone para aplicar bonus.
    if (att.requiresCrouch) {
      const crouched = playerState?.crouched || playerState?.prone || false
      if (!crouched) continue
    }
    if (att.magSizeMul) effective.magSize = Math.floor(effective.magSize * att.magSizeMul)
    if (att.reloadTimeMul) effective.reloadTime = effective.reloadTime * att.reloadTimeMul
    if (att.damageMul) {
      effective.bodyDamage = Math.floor(effective.bodyDamage * att.damageMul)
      effective.headDamage = Math.floor(effective.headDamage * att.damageMul)
    }
    if (att.raycastFarMul) effective.raycastFar = effective.raycastFar * att.raycastFarMul
    if (att.recoilMul) {
      effective.recoilPerShot = effective.recoilPerShot * att.recoilMul
      effective.recoilMax = effective.recoilMax * att.recoilMul
    }
    if (att.yawKickMul) effective.yawKick = (effective.yawKick || 0) * att.yawKickMul
    if (att.hipFireSpreadMul) effective.hipFireSpread = effective.hipFireSpread * att.hipFireSpreadMul
    if (att.adsSpreadMul) effective.adsSpread = effective.adsSpread * att.adsSpreadMul
    if (att.adsTimeMul) effective.adsTime = effective.adsTime * att.adsTimeMul
    if (att.adsFovMul) effective.adsFov = effective.adsFov * att.adsFovMul
    if (att.moveSpeedMul) effective.moveSpeedMul = (effective.moveSpeedMul || 1.0) * att.moveSpeedMul
    if (att.penetrationMul) effective.penetrationMul = att.penetrationMul
    if (att.burst) effective.burst = att.burst
    if (att.fireIntervalMul) effective.fireInterval = effective.fireInterval * att.fireIntervalMul
    if (att.slowOnHit) effective.slowOnHit = true
    if (att.markOnHit) effective.markOnHit = true
    if (att.scoreMul) effective.scoreMul = (effective.scoreMul || 1.0) * att.scoreMul
  }

  const perks = loadout.perks || {}
  for (const slot in perks) {
    const perkId = perks[slot]
    const perk = PERKS[perkId]
    if (!perk) continue
    if (perk.reloadTimeMul) effective.reloadTime = effective.reloadTime * perk.reloadTimeMul
    if (perk.damageMul) {
      effective.bodyDamage = Math.floor(effective.bodyDamage * perk.damageMul)
      effective.headDamage = Math.floor(effective.headDamage * perk.damageMul)
    }
    if (perk.moveSpeedMul) effective.moveSpeedMul = (effective.moveSpeedMul || 1.0) * perk.moveSpeedMul
    if (perk.hipFireSpreadMul) effective.hipFireSpread = effective.hipFireSpread * perk.hipFireSpreadMul
  }

  return effective
}

export function getEffectiveMaxHealth(loadout = getLoadout()) {
  let hp = PLAYER.maxHealth
  const perks = loadout.perks || {}
  for (const slot in perks) {
    const perk = PERKS[perks[slot]]
    if (perk && perk.healthBonus) hp += perk.healthBonus
  }
  return hp
}

export function hasPerk(perkId, loadout = getLoadout()) {
  const perks = loadout.perks || {}
  for (const slot in perks) {
    if (perks[slot] === perkId) return true
  }
  return false
}

export function getPrimaryWeapon(loadout = getLoadout()) {
  return applyLoadoutToWeapon(loadout.primary, loadout)
}

export function getSecondaryWeapon(loadout = getLoadout()) {
  return applyLoadoutToWeapon(loadout.secondary, loadout)
}

export function resetLoadout() {
  saveLoadout({ ...DEFAULT_LOADOUT, primaryAttachments: {}, secondaryAttachments: {} })
}
