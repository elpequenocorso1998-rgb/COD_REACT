import * as THREE from 'three'
import { buildHumanoid, animateWalk } from './humanoid.js'

/* =========================================================================
   Manager de enemigos (usando el humanoide anatómico).
   --------------------------------------------------------------------------
   Mejoras:
   - Separación entre enemigos (boids) para que no se apilen.
   - Sin allocations por frame: emissive con setHex en lugar de new Color.
   - Dispose de materiales clonados al eliminar enemigos muertos.
   - Doble bobbing eliminado: solo animateWalk mueve la cadera.
   ========================================================================= */
export function createEnemyManager(scene, world, particles) {
  const enemies = []
  let onKilledCb = null
  let onReachPlayerCb = null
  // Vector reutilizable para la separación.
  const _sep = new THREE.Vector3()

  function buildEnemy(hp, speed, damage, points) {
    const humanoid = buildHumanoid()
    const torsoMat = humanoid.torsoMesh.material.clone()
    humanoid.torsoMesh.material = torsoMat

    humanoid.headMesh.userData.enemy = null
    humanoid.torsoMesh.userData.enemy = null

    return {
      humanoid,
      group: humanoid.root,
      head: humanoid.headMesh,
      torso: humanoid.torsoMesh,
      maxHp: hp, hp, speed, damage, points,
      dead: false, hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      currentSpeed: 0
    }
  }

  function spawn(hp, speed, damage, points) {
    const e = buildEnemy(hp, speed, damage, points)
    const side = Math.floor(Math.random() * 4)
    const r = (Math.random() - 0.5) * 180
    if (side === 0) e.group.position.set(r, 0, -90)
    else if (side === 1) e.group.position.set(r, 0, 90)
    else if (side === 2) e.group.position.set(-90, 0, r)
    else e.group.position.set(90, 0, r)

    e.head.userData.enemy = e
    e.torso.userData.enemy = e
    scene.add(e.group)
    enemies.push(e)
  }

  const raycaster = new THREE.Raycaster()
  function handleShot(originVec, dirVec, onHit) {
    raycaster.set(originVec, dirVec)
    raycaster.far = 200
    const targets = []
    for (const e of enemies) {
      if (e.dead) continue
      targets.push(e.head, e.torso)
    }
    const hits = raycaster.intersectObjects(targets, false)
    if (hits.length === 0) return false

    const hit = hits[0]
    const enemy = hit.object.userData.enemy
    if (!enemy || enemy.dead) return false

    const isHead = hit.object === enemy.head
    const dmg = isHead ? 100 : 34
    enemy.hp -= dmg
    enemy.hitFlash = 0.12

    if (onHit) {
      const normal = dirVec.clone().negate()
      onHit(enemy, isHead, hit.point.clone(), normal)
    }

    if (enemy.hp <= 0) killEnemy(enemy, enemy.points)
    return true
  }

  function killEnemy(enemy, points = 0) {
    if (enemy.dead) return
    enemy.dead = true
    enemy.dyingT = 0
    if (onKilledCb) onKilledCb(enemy, points)
  }

  function update(dt, playerPos) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]

      // --- Animación de muerte: cae hacia adelante y se hunde ---
      if (e.dead) {
        e.dyingT = (e.dyingT || 0) + dt
        e.group.rotation.x = Math.min(Math.PI / 2, e.dyingT * 3)
        e.group.position.y = -e.dyingT * 0.4
        animateWalk(e.humanoid, e.walkPhase, 0)
        if (e.dyingT > 2.0) {
          scene.remove(e.group)
          // Dispose del material clonado del torso.
          e.torso.material.dispose()
          enemies.splice(i, 1)
        }
        continue
      }

      // --- IA: perseguir al jugador + separación ---
      const dx = playerPos.x - e.group.position.x
      const dz = playerPos.z - e.group.position.z
      const dist = Math.hypot(dx, dz)

      // Vector de separación: empuja al enemigo lejos de sus vecinos.
      _sep.set(0, 0, 0)
      for (const other of enemies) {
        if (other === e || other.dead) continue
        const odx = e.group.position.x - other.group.position.x
        const odz = e.group.position.z - other.group.position.z
        const odist = Math.hypot(odx, odz)
        if (odist < 2.0 && odist > 0.01) {
          const force = (2.0 - odist) / 2.0
          _sep.x += (odx / odist) * force
          _sep.z += (odz / odist) * force
        }
      }

      if (dist > 1.5) {
        const nx = dx / dist
        const nz = dz / dist
        // Combina dirección al jugador con separación.
        const moveX = nx + _sep.x * 0.5
        const moveZ = nz + _sep.z * 0.5
        const moveLen = Math.hypot(moveX, moveZ)
        const mx = moveLen > 0 ? moveX / moveLen : nx
        const mz = moveLen > 0 ? moveZ / moveLen : nz
        const step = e.speed * dt
        const tx = e.group.position.x + mx * step
        const tz = e.group.position.z + mz * step
        if (!world.collidesAt(tx, e.group.position.z, 0.5)) e.group.position.x = tx
        if (!world.collidesAt(e.group.position.x, tz, 0.5)) e.group.position.z = tz
        e.group.rotation.y = Math.atan2(nx, nz)

        // Animación de caminar.
        e.walkPhase += dt * (e.speed * 1.6)
        e.currentSpeed = 1
        animateWalk(e.humanoid, e.walkPhase, 1)
        // El bobbing vertical lo gestiona animateWalk (hips.position.y),
        // así que NO añadimos otro bob al grupo (bug fixed: doble bobbing).
      } else {
        if (onReachPlayerCb) onReachPlayerCb(e)
        killEnemy(e, 0)
      }

      // --- Flash al recibir impacto (sin allocation) ---
      if (e.hitFlash > 0) {
        e.hitFlash -= dt
        e.torso.material.emissive.setHex(0xff8080)
        e.torso.material.emissiveIntensity = e.hitFlash * 8
      } else {
        e.torso.material.emissiveIntensity = 0
      }
    }
  }

  function reset() {
    for (const e of enemies) {
      scene.remove(e.group)
      if (e.torso.material !== e.humanoid.torsoMesh.material) {
        e.torso.material.dispose()
      }
    }
    enemies.length = 0
  }

  function dispose() {
    for (const e of enemies) {
      scene.remove(e.group)
      e.torso.material.dispose()
    }
    enemies.length = 0
  }

  return {
    spawn, update, reset, dispose, handleShot,
    get count() { return enemies.filter((e) => !e.dead).length },
    set onKilled(fn) { onKilledCb = fn },
    set onReachPlayer(fn) { onReachPlayerCb = fn }
  }
}
