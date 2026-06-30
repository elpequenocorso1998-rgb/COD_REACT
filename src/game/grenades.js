import * as THREE from 'three'

/* =========================================================================
   Sistema de granadas y equipo táctico.
   --------------------------------------------------------------------------
   - Frag (G): explosión con radio y daño, timer de fuse cocinable.
   - Flashbang (Q): cegada temporal + screen flash blanco.
   - Smoke: cortina de humo que bloquea visión.
   - Throwable knife: daño instantáneo si impacta.
   Física: gravedad + rebote simple contra colliders AABB del mundo.
   ========================================================================= */

const GRENADE_GRAVITY = 18
const FUSE_TIME = 3.0           // segundos antes de explotar
const FRAG_RADIUS = 6
const FRAG_DAMAGE = 80
const FLASH_STUN_RADIUS = 6     // radio de aturdimiento de flashbang
const SMOKE_PARTICLE_COUNT = 20 // partículas de humo por granada de humo

export function createGrenadeSystem(scene, world, enemies, particles, audio, _player, store) {
  const projectiles = []
  // Geometría/material compartidos para granadas.
  const fragGeo = new THREE.SphereGeometry(0.12, 8, 8)
  const fragMat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, metalness: 0.6, roughness: 0.4 })
  const flashGeo = new THREE.SphereGeometry(0.1, 8, 8)
  const flashMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.5, roughness: 0.5 })
  const smokeGeo = new THREE.SphereGeometry(0.15, 8, 8)
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.3, roughness: 0.7 })
  const knifeGeo = new THREE.ConeGeometry(0.05, 0.3, 4)
  const knifeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 })

  // Vectores scratch.
  const _vel = new THREE.Vector3()
  const _pos = new THREE.Vector3()

  // Lanza una granada del tipo dado desde la posición del jugador.
  function throwGrenade(type, originPos, direction) {
    let geo, mat
    switch (type) {
      case 'frag': geo = fragGeo; mat = fragMat; break
      case 'flash': geo = flashGeo; mat = flashMat; break
      case 'smoke': geo = smokeGeo; mat = smokeMat; break
      case 'knife': geo = knifeGeo; mat = knifeMat; break
      default: return
    }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(originPos)
    scene.add(mesh)
    // Velocidad inicial: dirección + impulso hacia arriba.
    _vel.copy(direction).multiplyScalar(type === 'knife' ? 30 : 15)
    _vel.y += type === 'knife' ? 2 : 5
    projectiles.push({
      mesh,
      type,
      vel: _vel.clone(),
      fuse: FUSE_TIME,
      active: true,
      bounced: false
    })
    if (audio) audio.playReload?.() // reusamos click metálico como sonido de lanzamiento
  }

  // Fase 18.14: cook grenade — empieza el fuse sin lanzar.
  let cookingGrenade = null // { type, originPos, fuseStartedAt }

  function startCook(type, originPos) {
    if (cookingGrenade) return
    cookingGrenade = {
      type,
      originPos: originPos.clone(),
      fuseStartedAt: (typeof performance !== 'undefined' ? performance.now() : Date.now())
    }
    if (audio) audio.playReload?.()
  }

  function releaseCooked(direction) {
    if (!cookingGrenade) return null
    const { type, originPos, fuseStartedAt } = cookingGrenade
    cookingGrenade = null
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const elapsed = (now - fuseStartedAt) / 1000
    const remainingFuse = Math.max(0.1, FUSE_TIME - elapsed)
    // Si la fuse ya expiró mientras se cocinaba, explota en mano.
    if (remainingFuse <= 0.1) {
      explodeInHand(type, originPos)
      return { explodedInHand: true }
    }
    // Lanzar con fuse reducida.
    let geo, mat
    switch (type) {
      case 'frag': geo = fragGeo; mat = fragMat; break
      case 'flash': geo = flashGeo; mat = flashMat; break
      case 'smoke': geo = smokeGeo; mat = smokeMat; break
      case 'knife': geo = knifeGeo; mat = knifeMat; break
      default: return null
    }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(originPos)
    scene.add(mesh)
    _vel.copy(direction).multiplyScalar(type === 'knife' ? 30 : 15)
    _vel.y += type === 'knife' ? 2 : 5
    projectiles.push({
      mesh,
      type,
      vel: _vel.clone(),
      fuse: remainingFuse,
      active: true,
      bounced: false
    })
    return { explodedInHand: false }
  }

  function cancelCook() {
    cookingGrenade = null
  }

  function isCooking() {
    return cookingGrenade !== null
  }

  function getCookProgress() {
    if (!cookingGrenade) return 0
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const elapsed = (now - cookingGrenade.fuseStartedAt) / 1000
    return Math.min(1, elapsed / FUSE_TIME)
  }

  function explodeInHand(type, _originPos) {
    // Aplica daño al jugador si es frag; flash si es flash.
    if (type === 'frag' && store) {
      store.getState().takeDamage(FRAG_DAMAGE * 0.5, 0)
    } else if (type === 'flash' && store) {
      store.getState().flashPlayer(2000)
    }
    if (audio) audio.playExplosion?.()
  }

  function update(dt, _playerPos) {
    // Fase 18.14: si hay granada cocinándose y la fuse expira, explota en mano.
    if (cookingGrenade) {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const elapsed = (now - cookingGrenade.fuseStartedAt) / 1000
      if (elapsed >= FUSE_TIME) {
        const cg = cookingGrenade
        cookingGrenade = null
        explodeInHand(cg.type, cg.originPos)
      }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]
      if (!p.active) continue

      // Física: gravedad + movimiento + rebote.
      p.vel.y -= GRENADE_GRAVITY * dt
      const nextX = p.mesh.position.x + p.vel.x * dt
      const nextY = p.mesh.position.y + p.vel.y * dt
      const nextZ = p.mesh.position.z + p.vel.z * dt

      // Rebote contra el suelo.
      if (nextY < 0.1) {
        p.mesh.position.y = 0.1
        p.vel.y *= -0.4 // rebote con pérdida de energía
        p.vel.x *= 0.7
        p.vel.z *= 0.7
        p.bounced = true
      } else {
        p.mesh.position.y = nextY
      }

      // Rebote contra colliders (AABB): si la siguiente posición choca,
      // invertimos la velocidad en ese eje.
      if (world && world.collidesAt(nextX, p.mesh.position.z, 0.15)) {
        p.vel.x *= -0.5
      } else {
        p.mesh.position.x = nextX
      }
      if (world && world.collidesAt(p.mesh.position.x, nextZ, 0.15)) {
        p.vel.z *= -0.5
      } else {
        p.mesh.position.z = nextZ
      }

      // Rotación visual (efecto de giro).
      p.mesh.rotation.x += dt * 5
      p.mesh.rotation.y += dt * 3

      // Fase 6: throwing knife — detección de impacto con enemigos.
      // El knife vuela y si pasa cerca de un enemigo le hace daño instantáneo.
      if (p.type === 'knife' && enemies) {
        let hit = false
        enemies.forEachAlive((epos, _t, _ls, e) => {
          if (hit) return
          const d = Math.hypot(epos.x - p.mesh.position.x, epos.z - p.mesh.position.z)
          if (d < 1.0 && Math.abs(p.mesh.position.y - 1.0) < 1.5) {
            e.hp -= 150 // knife = kill instantáneo
            e.hitFlash = 0.12
            if (e.hp <= 0) { e.dead = true; e.dyingT = 0 }
            if (particles) particles.spawnSparks(p.mesh.position, new THREE.Vector3(0, 1, 0))
            hit = true
          }
        })
        if (hit) {
          scene.remove(p.mesh)
          p.active = false
          projectiles.splice(i, 1)
          continue
        }
      }

      // Fuse: cuenta atrás y explosiona.
      p.fuse -= dt
      if (p.fuse <= 0) {
        explode(p)
        scene.remove(p.mesh)
        p.active = false
        projectiles.splice(i, 1)
      }
    }
  }

  // Explosión/efecto según el tipo.
  function explode(p) {
    _pos.copy(p.mesh.position)
    switch (p.type) {
      case 'frag':
        if (particles) {
          particles.spawnSparks(_pos, new THREE.Vector3(0, 1, 0))
          particles.spawnSmoke(_pos, 8)
        }
        if (audio) audio.playExplosion?.()
        // Daño en radio a enemigos.
        if (enemies) {
          enemies.forEachAlive((epos, _t, _ls, e) => {
            const d = Math.hypot(epos.x - _pos.x, epos.z - _pos.z)
            if (d <= FRAG_RADIUS) {
              const dmg = FRAG_DAMAGE * (1 - d / FRAG_RADIUS) // caída con distancia
              e.hp -= dmg
              e.hitFlash = 0.12
              if (e.hp <= 0) { e.dead = true; e.dyingT = 0 }
            }
          })
        }
        break

      case 'flash':
        if (audio) audio.playExplosion?.()
        // Flash: cegada al jugador si está en el radio (sin importar línea
        // de visión — simplificación para jugabilidad).
        if (store && _player) {
          const ppos = _player.getPosition()
          const dToPlayer = Math.hypot(ppos.x - _pos.x, ppos.z - _pos.z)
          if (dToPlayer <= FLASH_STUN_RADIUS) {
            store.getState().flashPlayer(2000) // 2s de overlay blanco
          }
        }
        // Para enemigos: los aturde (reducen velocidad temporalmente).
        // Bug fixed: antes `e.speed *= 0.3` y la restauración era
        // `e.maxHp ? e.speed : e.speed / 0.3` que siempre evaluaba a
        // `e.speed` (maxHp es truthy) → slow permanente acumulativo.
        // Ahora guardamos originalSpeed y restauramos tras 2s.
        if (enemies) {
          enemies.forEachAlive((epos, _t, _ls, e) => {
            const d = Math.hypot(epos.x - _pos.x, epos.z - _pos.z)
            if (d <= FLASH_STUN_RADIUS) {
              if (!e.originalSpeed) e.originalSpeed = e.speed
              e.speed = e.originalSpeed * 0.3
              setTimeout(() => {
                if (e.originalSpeed) { e.speed = e.originalSpeed; e.originalSpeed = null }
              }, 2000)
            }
          })
        }
        break

      case 'smoke':
        // Cortina de humo: partículas densas que duran SMOKE_DURATION.
        if (particles) {
          for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
            particles.spawnSmoke(_pos, 1)
          }
        }
        break

      case 'knife':
        // El cuchillo se maneja por impacto directo (no fuse), pero si
        // no impactó, expira sin efecto.
        break
    }
  }

  function reset() {
    for (const p of projectiles) {
      scene.remove(p.mesh)
      p.active = false
    }
    projectiles.length = 0
    cookingGrenade = null
  }

  function dispose() {
    reset()
    fragGeo.dispose(); fragMat.dispose()
    flashGeo.dispose(); flashMat.dispose()
    smokeGeo.dispose(); smokeMat.dispose()
    knifeGeo.dispose(); knifeMat.dispose()
  }

  return {
    throwGrenade, update, reset, dispose,
    startCook, releaseCooked, cancelCook, isCooking, getCookProgress
  }
}
