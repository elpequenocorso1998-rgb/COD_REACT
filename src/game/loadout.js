import { WEAPONS, PERKS, ATTACHMENTS, DEFAULT_LOADOUT, PLAYER } from './config.js'

/* =========================================================================
   Loadout — sistema de create-a-class.
   --------------------------------------------------------------------------
   Gestiona el loadout del jugador (primary, secondary, tactical, lethal,
   perks, attachments). Aplica los efectos de perks y attachments al
   equipar un arma, devolviendo un "weaponDef efectivo" con los stats
   modificados.

   Persistencia: se guarda en localStorage via progression.js.
   ========================================================================= */

const LOADOUT_KEY = 'mw_loadout_v1'

let _loadout = null

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
}

// Aplica los attachments y perks al weaponDef base, devolviendo un
// weaponDef efectivo con los stats modificados. NO muta el original.
export function applyLoadoutToWeapon(weaponId, loadout = getLoadout()) {
  const base = WEAPONS[weaponId]
  if (!base) return WEAPONS.m4

  // Empezamos desde una copia del arma base.
  const effective = { ...base }

  // Aplicamos attachments del arma primaria si coincide.
  const attachmentsMap = (weaponId === loadout.primary)
    ? loadout.primaryAttachments
    : {}
  for (const slot in attachmentsMap) {
    const attId = attachmentsMap[slot]
    const att = ATTACHMENTS[attId]
    if (!att) continue
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
    if (att.hipFireSpreadMul) effective.hipFireSpread = effective.hipFireSpread * att.hipFireSpreadMul
    if (att.adsSpreadMul) effective.adsSpread = effective.adsSpread * att.adsSpreadMul
    if (att.adsTimeMul) effective.adsTime = effective.adsTime * att.adsTimeMul
    if (att.adsFovMul) effective.adsFov = effective.adsFov * att.adsFovMul
    if (att.moveSpeedMul) effective.moveSpeedMul = (effective.moveSpeedMul || 1.0) * att.moveSpeedMul
    if (att.penetrationMul) effective.penetrationMul = att.penetrationMul
  }

  // Aplicamos perks.
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

// Devuelve la vida máxima efectiva (con Juggernaut si está equipado).
export function getEffectiveMaxHealth(loadout = getLoadout()) {
  let hp = PLAYER.maxHealth
  const perks = loadout.perks || {}
  for (const slot in perks) {
    const perk = PERKS[perks[slot]]
    if (perk && perk.healthBonus) hp += perk.healthBonus
  }
  return hp
}

// Devuelve true si el loadout tiene un perk concreto.
export function hasPerk(perkId, loadout = getLoadout()) {
  const perks = loadout.perks || {}
  for (const slot in perks) {
    if (perks[slot] === perkId) return true
  }
  return false
}

// Devuelve el arma primaria efectiva (con attachments + perks aplicados).
export function getPrimaryWeapon(loadout = getLoadout()) {
  return applyLoadoutToWeapon(loadout.primary, loadout)
}

// Devuelve el arma secundaria efectiva.
export function getSecondaryWeapon(loadout = getLoadout()) {
  return applyLoadoutToWeapon(loadout.secondary, loadout)
}

// Resetea al loadout por defecto.
export function resetLoadout() {
  saveLoadout({ ...DEFAULT_LOADOUT, primaryAttachments: {} })
}
