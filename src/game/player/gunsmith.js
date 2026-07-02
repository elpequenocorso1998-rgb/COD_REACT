/* =========================================================================
   Gunsmith depth (Fase 18.47).
   --------------------------------------------------------------------------
   - Stat bars: calcula 5 stats normalizadas (0-100) para mostrar en UI.
   - Stat deltas: diferencia al aplicar attachments (+/-).
   - Reticle editor: 8 reticles predefinidos + custom (color, shape, size).
   ========================================================================= */

import { WEAPONS } from '@/game/core/config'
import { applyLoadoutToWeapon } from '@/game/player/loadout'

export const STAT_KEYS = ['damage', 'range', 'firerate', 'mobility', 'control']

export function computeStatBars(weaponId, loadout = null) {
  const weaponDef = WEAPONS[weaponId]
  if (!weaponDef) return null
  const effective = loadout
    ? applyLoadoutToWeapon(weaponId, loadout)
    : { ...weaponDef }
  return {
    damage: normalizeDamage(effective.bodyDamage),
    range: normalizeRange(effective.raycastFar, effective.damageRange),
    firerate: normalizeFirerate(effective.fireInterval),
    mobility: normalizeMobility(effective.moveSpeedMul || 1.0, effective.adsTime),
    control: normalizeControl(effective.recoilPerShot, effective.hipFireSpread)
  }
}

function normalizeDamage(bodyDamage) {
  return clamp(Math.round((bodyDamage / 60) * 100), 5, 100)
}
function normalizeRange(raycastFar, damageRange) {
  const far = raycastFar || 100
  let score = (far / 200) * 60
  if (damageRange && damageRange.length > 1) {
    const longRange = damageRange[damageRange.length - 1]
    if (longRange && longRange.mul) score += longRange.mul * 40
  }
  return clamp(Math.round(score), 5, 100)
}
function normalizeFirerate(fireInterval) {
  if (!fireInterval) return 50
  const rps = 1 / fireInterval
  return clamp(Math.round((rps / 15) * 100), 5, 100)
}
function normalizeMobility(moveSpeedMul, adsTime) {
  const speedScore = (moveSpeedMul - 0.7) / 0.5 * 60
  const adsScore = (1 - (adsTime || 0.3) / 0.6) * 40
  return clamp(Math.round(speedScore + adsScore), 5, 100)
}
function normalizeControl(recoilPerShot, hipFireSpread) {
  const recoilScore = (1 - (recoilPerShot || 0.02) / 0.1) * 60
  const spreadScore = (1 - (hipFireSpread || 0.02) / 0.08) * 40
  return clamp(Math.round(recoilScore + spreadScore), 5, 100)
}

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

export function computeStatDeltas(weaponId, baseLoadout, modifiedLoadout) {
  const base = computeStatBars(weaponId, baseLoadout)
  const modified = computeStatBars(weaponId, modifiedLoadout)
  if (!base || !modified) return null
  const delta = {}
  for (const k of STAT_KEYS) {
    delta[k] = modified[k] - base[k]
  }
  return delta
}

// --- Reticle editor ---
export const RETICLE_SHAPES = ['dot', 'cross', 't', 'chevron', 'circle', 'square', 'triangle', 'diamond']

export const DEFAULT_RETICLES = [
  { id: 'dot', shape: 'dot', color: '#00ff00', size: 2 },
  { id: 'cross', shape: 'cross', color: '#00ff00', size: 6 },
  { id: 't-mark', shape: 't', color: '#ffffff', size: 6 },
  { id: 'chevron', shape: 'chevron', color: '#ff5500', size: 8 },
  { id: 'circle', shape: 'circle', color: '#00aaff', size: 10 },
  { id: 'square', shape: 'square', color: '#ff00ff', size: 6 },
  { id: 'triangle', shape: 'triangle', color: '#ffff00', size: 8 },
  { id: 'diamond', shape: 'diamond', color: '#00ffff', size: 8 }
]

export function createCustomReticle({ shape = 'dot', color = '#00ff00', size = 4 } = {}) {
  if (!RETICLE_SHAPES.includes(shape)) shape = 'dot'
  if (typeof color !== 'string' || !color.startsWith('#')) color = '#00ff00'
  if (!Number.isFinite(size) || size < 1) size = 4
  if (size > 20) size = 20
  return { id: 'custom', shape, color, size }
}

export function drawReticleOnCanvas(ctx, reticle, cx, cy) {
  if (!ctx || !reticle) return
  const { shape, color, size } = reticle
  ctx.save()
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  const s = size
  switch (shape) {
    case 'dot':
      ctx.beginPath()
      ctx.arc(cx, cy, s, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'cross':
      ctx.fillRect(cx - s, cy - 1, s * 2, 2)
      ctx.fillRect(cx - 1, cy - s, 2, s * 2)
      break
    case 't':
      ctx.fillRect(cx - s, cy - s, s * 2, 2)
      ctx.fillRect(cx - 1, cy - s, 2, s * 2)
      break
    case 'chevron':
      ctx.beginPath()
      ctx.moveTo(cx - s, cy - s)
      ctx.lineTo(cx, cy)
      ctx.lineTo(cx + s, cy - s)
      ctx.stroke()
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(cx, cy, s, 0, Math.PI * 2)
      ctx.stroke()
      break
    case 'square':
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2)
      break
    case 'triangle':
      ctx.beginPath()
      ctx.moveTo(cx, cy - s)
      ctx.lineTo(cx - s, cy + s)
      ctx.lineTo(cx + s, cy + s)
      ctx.closePath()
      ctx.fill()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(cx, cy - s)
      ctx.lineTo(cx + s, cy)
      ctx.lineTo(cx, cy + s)
      ctx.lineTo(cx - s, cy)
      ctx.closePath()
      ctx.fill()
      break
    default:
      break
  }
  ctx.restore()
}
