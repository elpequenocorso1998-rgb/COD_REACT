import * as THREE from 'three'
import { buildHumanoid, animateWalk, disposeHumanoidShared } from './humanoid.js'
import { WEAPON, ENEMY_TYPES, WAVE_SCALING } from './config.js'

/* =========================================================================
   Manager de enemigos (usando el humanoide anatómico).
   --------------------------------------------------------------------------
   Mejoras:
   - Separación entre enemigos (boids) para que no se apilen.
   - Sin allocations por frame: emissive con setHex en lugar de new Color.
   - Dispose de materiales clonados Y geometrías por-enemigo al eliminar.
   - Doble bobbing eliminado: solo animateWalk mueve la cadera.
   - Wall-avoidance: si el enemigo está bloqueado, deriva tangente al muro.
   - hitFlash reseteado al morir (antes el cadáver quedaba rojo brillante).
   - Hit-testing incluye chaleco y casco (no solo torso/cabeza).
   ========================================================================= */
export function createEnemyManager(scene, world, _particles, audio) {
  const enemies = []
  let onKilledCb = null
  let onReachPlayerCb = null
  // Vectores reutilizados (sin allocations por frame).
  const _sep = new THREE.Vector3()
  // Array reutilizable para targets de raycast (evita alloc por disparo).
  const _targets = []
  const _hitNormal = new THREE.Vector3()
  const _hitPoint = new THREE.Vector3()

  function buildEnemy(hp, speed, damage, points, typeDef) {
    const humanoid = buildHumanoid()
    // Clonamos el material del torso para que cada enemigo tenga su propio
    // emissive independiente (flash de impacto).
    const torsoMat = humanoid.torsoMesh.material.clone()
    humanoid.torsoMesh.material = torsoMat
    // Igual con vestMesh (también recibe impactos y flash).
    const vestMat = humanoid.vestMesh.material.clone()
    humanoid.vestMesh.material = vestMat

    // userData.enemy apunta al objeto enemy (lo lee handleShot).
    humanoid.headMesh.userData.enemy = null
    humanoid.torsoMesh.userData.enemy = null
    humanoid.vestMesh.userData.enemy = null
    humanoid.helmetMesh.userData.enemy = null
    // Marca qué partes son "head" para el headshot.
    humanoid.headMesh.userData.part = 'head'
    humanoid.helmetMesh.userData.part = 'head'
    humanoid.torsoMesh.userData.part = 'body'
    humanoid.vestMesh.userData.part = 'body'

    // Escala por tipo (boss más grande, runner más pequeño).
    if (typeDef && typeDef.scale && typeDef.scale !== 1.0) {
      humanoid.root.scale.setScalar(typeDef.scale)
    }

    return {
      humanoid,
      group: humanoid.root,
      head: humanoid.headMesh,
      helmet: humanoid.helmetMesh,
      torso: humanoid.torsoMesh,
      vest: humanoid.vestMesh,
      perEnemyGeos: humanoid.perEnemyGeos,
      materials: [torsoMat, vestMat],
      maxHp: hp, hp, speed, damage, points,
      dead: false, hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      currentSpeed: 0,
      // Wall-avoidance: detecta atascos y deriva tangente al muro.
      stuckTime: 0,
      lastX: 0, lastZ: 0,
      avoidDir: 0, // ángulo tangente actual
      // Minimap: timestamp del último ataque/disparo (muzzle report).
      lastShotAt: 0,
      // Tipo de enemigo (para minimap diferenciar runners/tanks/etc).
      typeName: typeDef ? typeDef.name : 'walker',
      // IA de disparo: cooldown entre disparos, línea de visión.
      shootCooldown: 0,
      isRanged: typeDef ? !!typeDef.ranged : false,
      // Cover: cuando recibe daño, busca cubrirse temporalmente.
      coverTimer: 0,
      // Tracer visual: mesh efímero del rayo del disparo.
      tracerMesh: null,
      tracerTimer: 0
    }
  }

  function spawn(hp, speed, damage, points, typeDef) {
    const e = buildEnemy(hp, speed, damage, points, typeDef)
    const side = Math.floor(Math.random() * 4)
    const r = (Math.random() - 0.5) * 180
    if (side === 0) e.group.position.set(r, 0, -90)
    else if (side === 1) e.group.position.set(r, 0, 90)
    else if (side === 2) e.group.position.set(-90, 0, r)
    else e.group.position.set(90, 0, r)

    e.lastX = e.group.position.x
    e.lastZ = e.group.position.z

    e.head.userData.enemy = e
    e.helmet.userData.enemy = e
    e.torso.userData.enemy = e
    e.vest.userData.enemy = e
    scene.add(e.group)
    enemies.push(e)
  }

  const raycaster = new THREE.Raycaster()
  raycaster.far = WEAPON.raycastFar
  // handleShot: originVec/dirVec son el rayo; onHit callback por impacto.
  // weaponDef opcional: si se pasa, usa sus bodyDamage/headDamage/raycastFar
  // (para soportar múltiples armas con stats distintos).
  function handleShot(originVec, dirVec, onHit, weaponDef = null) {
    const far = weaponDef ? weaponDef.raycastFar : WEAPON.raycastFar
    const bodyDmg = weaponDef ? weaponDef.bodyDamage : WEAPON.bodyDamage
    const headDmg = weaponDef ? weaponDef.headDamage : WEAPON.headDamage
    raycaster.set(originVec, dirVec)
    raycaster.far = far
    // Reutilizamos _targets: lo vaciamos y lo llenamos sin allocar.
    _targets.length = 0
    for (const e of enemies) {
      if (e.dead) continue
      // Cabeza, casco (headshots), torso y chaleco (body shots).
      _targets.push(e.head, e.helmet, e.torso, e.vest)
    }
    const hits = raycaster.intersectObjects(_targets, false)
    if (hits.length === 0) return false

    const hit = hits[0]
    const enemy = hit.object.userData.enemy
    if (!enemy || enemy.dead) return false

    const isHead = hit.object.userData.part === 'head'
    const dmg = isHead ? headDmg : bodyDmg
    enemy.hp -= dmg
    enemy.hitFlash = 0.12

    if (onHit) {
      _hitNormal.copy(dirVec).negate()
      _hitPoint.copy(hit.point)
      onHit(enemy, isHead, _hitPoint, _hitNormal)
    }

    if (enemy.hp <= 0) killEnemy(enemy, enemy.points)
    return true
  }

  function killEnemy(enemy, points = 0) {
    if (enemy.dead) return
    enemy.dead = true
    enemy.dyingT = 0
    enemy.hitFlash = 0
    // Apagamos el emissive inmediatamente para que el cadáver no brille.
    for (const m of enemy.materials) m.emissiveIntensity = 0
    if (onKilledCb) onKilledCb(enemy, points)
  }

  function disposeEnemy(e) {
    scene.remove(e.group)
    for (const m of e.materials) m.dispose()
    // Liberamos las geometrías por-enemigo (belt, pockets, visor, eyes,
    // brows). Las compartidas las libera disposeHumanoidShared().
    for (const g of e.perEnemyGeos) g.dispose()
    e.perEnemyGeos.length = 0
    // Tracer efímero si existe.
    if (e.tracerMesh) {
      scene.remove(e.tracerMesh)
      e.tracerMesh.geometry.dispose()
      e.tracerMesh.material.dispose()
      e.tracerMesh = null
    }
  }

  // --- Disparo enemigo: hitscan con tracer visual ---
  // Lógica: si el enemigo tiene línea de visión (no hay collider entre él
  // y el jugador), dispara. Daño con probabilidad de acierto (no siempre
  // acierta para ser justo). El tracer es una línea efímera visible.
  const _tracerGeo = new THREE.BufferGeometry()
  _tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  const _tracerMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.8 })
  const _shootOrigin = new THREE.Vector3()
  const _shootDir = new THREE.Vector3()
  const _tracerPositions = new Float32Array(6)

  function enemyShoot(e, playerPos) {
    // Origen del disparo: posición del torso del enemigo.
    _shootOrigin.set(e.group.position.x, 1.4, e.group.position.z)
    _shootDir.set(
      playerPos.x - _shootOrigin.x,
      playerPos.y - _shootOrigin.y,
      playerPos.z - _shootOrigin.z
    ).normalize()
    // Línea de visión: comprobamos si hay un collider entre el enemigo y el jugador.
    const distToPlayer = Math.hypot(playerPos.x - _shootOrigin.x, playerPos.z - _shootOrigin.z)
    let blocked = false
    if (world && world.colliders) {
      const _ray = new THREE.Ray(_shootOrigin, _shootDir)
      const _hitPoint = new THREE.Vector3()
      for (const c of world.colliders) {
        if (_ray.intersectBox(c.box, _hitPoint)) {
          const d = _shootOrigin.distanceTo(_hitPoint)
          if (d < distToPlayer) { blocked = true; break }
        }
      }
    }
    if (blocked) return // sin línea de visión, no dispara.

    // Probabilidad de acierto: 60% base, reducida por distancia.
    const hitChance = Math.max(0.2, 0.7 - distToPlayer * 0.01)
    const hit = Math.random() < hitChance

    // Tracer visual: línea desde el enemigo hasta el jugador (o hasta donde
    // impacta si no acierta).
    _tracerPositions[0] = _shootOrigin.x
    _tracerPositions[1] = _shootOrigin.y
    _tracerPositions[2] = _shootOrigin.z
    if (hit) {
      _tracerPositions[3] = playerPos.x
      _tracerPositions[4] = playerPos.y
      _tracerPositions[5] = playerPos.z
    } else {
      // Fallo: el tracer va hacia un punto desviado cerca del jugador.
      _tracerPositions[3] = playerPos.x + (Math.random() - 0.5) * 3
      _tracerPositions[4] = playerPos.y + (Math.random() - 0.5) * 2
      _tracerPositions[5] = playerPos.z + (Math.random() - 0.5) * 3
    }
    _tracerGeo.getAttribute('position').array.set(_tracerPositions)
    _tracerGeo.getAttribute('position').needsUpdate = true
    _tracerGeo.computeBoundingSphere()
    // Creamos una Line efímera para el tracer.
    const tracerLine = new THREE.Line(_tracerGeo.clone(), _tracerMat.clone())
    scene.add(tracerLine)
    e.tracerMesh = tracerLine
    e.tracerTimer = 0.08 // 80ms visible

    // Muzzle report para minimap.
    e.lastShotAt = performance.now()

    // Sonido de disparo enemigo con audio 3D posicional.
    if (audio) audio.playEnemyShoot?.(_shootOrigin, playerPos)

    // Si acierta, aplicamos daño via callback (engine registra takeDamage).
    if (hit && onShootPlayerCb) {
      onShootPlayerCb(e, e.damage)
    }
  }

  let onShootPlayerCb = null

  function update(dt, playerPos) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]

      // --- Animación de muerte: cae hacia adelante y se hunde ---
      if (e.dead) {
        e.dyingT = (e.dyingT || 0) + dt
        e.group.rotation.x = Math.min(Math.PI / 2, e.dyingT * 3)
        e.group.position.y = -e.dyingT * 0.4
        // Congelamos la pose; no llamamos a animateWalk (antes dejaba
        // torcido el cadáver por no resetear spine.z / chest.y / hips.y).
        if (e.dyingT > 2.0) {
          disposeEnemy(e)
          enemies.splice(i, 1)
        }
        continue
      }

      // --- IA: perseguir al jugador + separación + wall avoidance ---
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
        // --- IA de disparo: enemigos ranged se detienen a distancia y disparan ---
        const PREFERRED_RANGE = 20
        const inRange = e.isRanged && dist < PREFERRED_RANGE && dist > 5
        if (inRange) {
          // En rango: no se mueve, dispara si tiene línea de visión.
          e.shootCooldown -= dt
          if (e.shootCooldown <= 0) {
            e.shootCooldown = 1.0 + Math.random() * 1.5 // 1-2.5s entre disparos
            enemyShoot(e, playerPos)
          }
          // Apunta al jugador pero no se mueve.
          e.group.rotation.y = Math.atan2(nx, nz)
          animateWalk(e.humanoid, e.walkPhase, 0) // idle
        } else {
          // Combina dirección al jugador con separación.
          let moveX = nx + _sep.x * 0.5
          let moveZ = nz + _sep.z * 0.5

          // --- Wall avoidance: si apenas nos hemos movido desde el frame
          // anterior, asumimos que estamos contra un muro y derivamos
          // tangente al muro (90° respecto a la dirección al jugador).
          const moved = Math.hypot(e.group.position.x - e.lastX, e.group.position.z - e.lastZ)
          if (moved < e.speed * dt * 0.3) {
            e.stuckTime += dt
            if (e.stuckTime > 0.3) {
              // Derivamos tangente (rotamos 90° la dirección deseada).
              if (e.avoidDir === 0) e.avoidDir = Math.random() < 0.5 ? 1 : -1
              moveX = -nz * e.avoidDir + _sep.x * 0.3
              moveZ = nx * e.avoidDir + _sep.z * 0.3
            }
          } else {
            e.stuckTime = 0
            e.avoidDir = 0
          }
          e.lastX = e.group.position.x
          e.lastZ = e.group.position.z

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
        }
      } else {
        // Al llegar al jugador, idle breve antes de morir.
        animateWalk(e.humanoid, e.walkPhase, 0)
        if (onReachPlayerCb) onReachPlayerCb(e)
        killEnemy(e, 0)
        continue
      }

      // --- Flash al recibir impacto (sin allocation) ---
      if (e.hitFlash > 0) {
        e.hitFlash -= dt
        for (const m of e.materials) {
          m.emissive.setHex(0xff8080)
          m.emissiveIntensity = e.hitFlash * 8
        }
      } else {
        for (const m of e.materials) m.emissiveIntensity = 0
      }

      // --- Tracer: expira y se elimina tras 80ms ---
      if (e.tracerMesh) {
        e.tracerTimer -= dt
        if (e.tracerTimer <= 0) {
          scene.remove(e.tracerMesh)
          e.tracerMesh.geometry.dispose()
          e.tracerMesh.material.dispose()
          e.tracerMesh = null
        } else {
          // Fade out del tracer.
          e.tracerMesh.material.opacity = e.tracerTimer / 0.08 * 0.8
        }
      }
    }
  }

  function reset() {
    for (const e of enemies) disposeEnemy(e)
    enemies.length = 0
  }

  function dispose() {
    for (const e of enemies) disposeEnemy(e)
    enemies.length = 0
    // Liberamos los recursos compartidos del humanoide (materiales y
    // geometrías compartidas entre todos los enemigos). Antes nunca se
    // liberaban, causando un leak al recrear el engine.
    disposeHumanoidShared()
    // Tracer shared resources.
    _tracerGeo.dispose()
    _tracerMat.dispose()
  }

  return {
    spawn, update, reset, dispose, handleShot,
    // Itera enemigos vivos exponiendo posición/tipo para el minimap.
    // O(n) pero n es pequeño (típicamente <30) y solo se llama para pintar.
    forEachAlive(fn) {
      for (const e of enemies) {
        if (e.dead) continue
        fn(e.group.position, e.typeName, e.lastShotAt, e)
      }
    },
    // Marca que un enemigo ha disparado/atacado (muzzle report para minimap).
    markShot(enemy) { if (enemy) enemy.lastShotAt = performance.now() },
    get count() {
      // Sin allocation: contamos in-place.
      let n = 0
      for (const e of enemies) if (!e.dead) n++
      return n
    },
    // allCleared: true cuando no quedan enemigos vivos NI cadaveres
    // (los cadaveres tardan 2s en hundirse y desaparecer). Se usa para
    // evitar que la siguiente oleada spawnee encima de cuerpos.
    get allCleared() { return enemies.length === 0 },
    set onKilled(fn) { onKilledCb = fn },
    set onReachPlayer(fn) { onReachPlayerCb = fn },
    set onShootPlayer(fn) { onShootPlayerCb = fn }
  }
}

// Exportamos ENEMY_TYPES y WAVE_SCALING para que engine.js pueda usarlos
// sin importarlos de config.js por separado (un solo punto de entrada).
export { ENEMY_TYPES, WAVE_SCALING }
