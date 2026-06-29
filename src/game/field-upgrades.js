import * as THREE from 'three'
import { FIELD_UPGRADES } from './config.js'

/* =========================================================================
   Field upgrades — desplegables con cooldown.
   --------------------------------------------------------------------------
   Cada field upgrade es una entidad que se coloca en el mundo y tiene
   efecto durante un tiempo limitado. Factory pattern con dispose.
   ========================================================================= */

export function createFieldUpgradeSystem(scene, enemies, particles, audio, player, store) {
  const active = []
  const cooldowns = new Map()

  function canDeploy(fuId) {
    const fu = FIELD_UPGRADES[fuId]
    if (!fu) return false
    const last = cooldowns.get(fuId) || 0
    return (performance.now() / 1000) - last >= fu.cooldown
  }

  function getCooldownRemaining(fuId) {
    const fu = FIELD_UPGRADES[fuId]
    if (!fu) return 0
    const last = cooldowns.get(fuId) || 0
    const elapsed = (performance.now() / 1000) - last
    return Math.max(0, fu.cooldown - elapsed)
  }

  function deploy(fuId, position) {
    if (!canDeploy(fuId)) return false
    const fu = FIELD_UPGRADES[fuId]
    if (!fu) return false
    cooldowns.set(fuId, performance.now() / 1000)

    const entity = createEntity(fu, position, scene, enemies, particles, audio, player, store)
    active.push(entity)
    return true
  }

  function update(dt) {
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i]
      e.update(dt)
      if (e.isExpired) {
        e.dispose()
        active.splice(i, 1)
      }
    }
  }

  function reset() {
    active.forEach((e) => e.dispose())
    active.length = 0
    cooldowns.clear()
  }

  function dispose() {
    reset()
  }

  return { deploy, update, canDeploy, getCooldownRemaining, reset, dispose }
}

function createEntity(fu, position, scene, enemies, particles, audio, _player, _store) {
  const group = new THREE.Group()
  group.position.copy(position)
  scene.add(group)

  let elapsed = 0
  let isExpired = false
  let chargesUsed = 0

  const visual = buildVisual(fu, group)
  let effectTimer = 0

  function update(dt) {
    elapsed += dt
    effectTimer += dt

    if (fu.duration && elapsed >= fu.duration) {
      isExpired = true
      return
    }

    if (fu.id === 'trophySystem' && fu.radius) {
      if (effectTimer >= 0.2) {
        effectTimer = 0
      }
    }

    if (fu.id === 'reconTower' || fu.id === 'reconDrone') {
      if (effectTimer >= 1.0) {
        effectTimer = 0
        if (enemies && fu.radius) {
          enemies.forEachAlive((e) => {
            const dx = e.group.position.x - position.x
            const dz = e.group.position.z - position.z
            if (dx * dx + dz * dz <= fu.radius * fu.radius) {
              e.markedUntil = elapsed + 2
            }
          })
        }
      }
    }

    if (fu.id === 'suppressingDrone' && fu.radius && enemies) {
      if (effectTimer >= 0.5) {
        effectTimer = 0
        enemies.suppressNear(position, fu.radius)
      }
    }

    if (fu.id === 'munitionsBox' && fu.radius) {
      if (effectTimer >= 1.0) {
        effectTimer = 0
        if (_player && _player.getPosition) {
          const p = _player.getPosition()
          const dx = p.x - position.x
          const dz = p.z - position.z
          if (dx * dx + dz * dz <= fu.radius * fu.radius) {
            if (_store) {
              _store.addReserve(5)
            }
          }
        }
      }
    }

    if (visual.update) visual.update(dt, elapsed)
  }

  function consumeCharge() {
    chargesUsed++
    if (fu.charges && chargesUsed >= fu.charges) {
      isExpired = true
    }
  }

  function dispose() {
    if (visual.dispose) visual.dispose()
    scene.remove(group)
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) o.material.dispose()
    })
  }

  return { update, consumeCharge, get isExpired() { return isExpired }, dispose }
}

function buildVisual(fu, parent) {
  const geo = new THREE.IcosahedronGeometry(0.3, 0)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    emissive: 0x224488,
    emissiveIntensity: 0.5,
    metalness: 0.6,
    roughness: 0.3,
    transparent: true,
    opacity: 0.7
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 1
  parent.add(mesh)

  const ringGeo = new THREE.TorusGeometry(0.6, 0.04, 8, 24)
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x4488ff,
    transparent: true,
    opacity: 0.4
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.05
  parent.add(ring)

  return {
    update(dt, elapsed) {
      mesh.rotation.y += dt * 1.5
      ring.rotation.z += dt * 0.8
      const pulse = 0.5 + Math.sin(elapsed * 4) * 0.2
      mat.emissiveIntensity = pulse
      if (fu.duration) {
        const remaining = Math.max(0, 1 - elapsed / fu.duration)
        mat.opacity = 0.7 * remaining
        ringMat.opacity = 0.4 * remaining
      }
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
    }
  }
}
