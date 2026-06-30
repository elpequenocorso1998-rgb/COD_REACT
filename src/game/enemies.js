import * as THREE from 'three'
import { buildHumanoid, animateWalk, disposeHumanoidShared } from './humanoid.js'
import { WEAPON, ENEMY_TYPES, WAVE_SCALING, DAMAGE_MULTIPLIERS, PENETRATION, DEFAULT_DAMAGE_RANGE } from './config.js'
import { createAIController } from './ai.js'
import { createRagdoll } from './ragdoll.js'

/* =========================================================================
   Manager de enemigos (usando el humanoide anatómico).
   --------------------------------------------------------------------------
   Mejoras (Fase 1.2):
   - AI táctica vía ai.js (state machine: Engage/Flank/TakeCover/etc).
   - Pathfinding por navmesh (rutas reales, no persecución en línea recta).
   - Ragdoll al morir (caída natural con verlet, no rotar+hundir).
   - Suppression: el fuego del jugador cerca del bot lo manda a cobertura.
   - Separación boids (heredado) para que no se apilen.
   - Dispose de materiales clonados Y geometrías por-enemigo.
   - Wall-avoidance (heredado).
   - hitFlash reseteado al morir.
   - Hit-testing incluye chaleco y casco (no solo torso/cabeza).
   ========================================================================= */
export function createEnemyManager(scene, world, _particles, audio, navmesh = null) {
  const enemies = []
  let onKilledCb = null
  let onReachPlayerCb = null
  let onEnemyShootCb = null
  const aiController = createAIController(navmesh)
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
    humanoid.torsoMesh.userData.part = 'chest'
    humanoid.vestMesh.userData.part = 'chest'
    // Fase 1.3: stomach = cadera (parte baja del torso).
    if (humanoid.hipMesh) {
      humanoid.hipMesh.userData.enemy = null
      humanoid.hipMesh.userData.part = 'stomach'
    }
    // Fase 1.3: brazos y piernas como zonas con multiplier de limb.
    if (humanoid.limbMeshes) {
      for (const m of humanoid.limbMeshes) {
        m.userData.enemy = null
        // Distinguimos arm/leg por la posición Y del mesh en mundo.
        // Simplificación: cualquier mesh de limb se marca como 'arm' o 'leg'
        // según si está en la mitad superior o inferior del cuerpo.
        m.userData.part = 'arm' // por defecto; lo refinamos abajo
      }
      // Refinamos: los meshes de piernas (thigh/shin/calf/foot) son 'leg'.
      // Los identificamos por nombre o por posición. Aquí usamos el hecho
      // de que legL/legR.thigh etc. están en la lista en orden conocido:
      // [armL.upperArm, armL.lowerArm, armL.hand, armR..., legL.thigh...]
      // Fase 7: bug fixed — el loop empezaba en i=12 pero las piernas
      // empiezan en i=6 (6 meshes de brazos: 2 brazos × 3 partes).
      // Indices 6-13 son piernas (2 piernas × 4 partes: thigh/shin/calf/foot).
      const limbs = humanoid.limbMeshes
      for (let i = 6; i < limbs.length; i++) {
        limbs[i].userData.part = 'leg'
      }
    }

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
      stomach: humanoid.hipMesh || null,
      limbs: humanoid.limbMeshes || [],
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
      tracerTimer: 0,
      // AI táctica (Fase 1.2): se inicializa al spawnear via aiController.
      ai: null,
      // Ragdoll al morir (Fase 1.2): simulación verlet.
      ragdoll: null,
      // Contador de disparos (para IA: recarga cada 5).
      shotsFired: 0,
      // Cámara de muerte (animación legacy desactivada; ahora ragdoll).
      dyingT: 0
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
    // Fase 1.3: stomach y limbs también son hit-targets.
    if (e.stomach) e.stomach.userData.enemy = e
    for (const m of e.limbs) m.userData.enemy = e
    // Inicializa el estado IA del bot.
    aiController.init(e)
    scene.add(e.group)
    enemies.push(e)
  }

  const raycaster = new THREE.Raycaster()
  raycaster.far = WEAPON.raycastFar
  // Fase 1.3: vector scratch para wallbang (raycast contra colliders).
  const _wbRay = new THREE.Ray()
  const _wbPoint = new THREE.Vector3()
  // handleShot: originVec/dirVec son el rayo; onHit callback por impacto.
  // weaponDef opcional: si se pasa, usa sus bodyDamage/headDamage/raycastFar
  // (para soportar múltiples armas con stats distintos).
  // Fase 1.3: aplica DAMAGE_MULTIPLIERS por zona y PENETRATION si el
  // disparo atraviesa un collider antes de golpear al enemigo (wallbang).
  function handleShot(originVec, dirVec, onHit, weaponDef = null) {
    const far = weaponDef ? weaponDef.raycastFar : WEAPON.raycastFar
    const bodyDmg = weaponDef ? weaponDef.bodyDamage : WEAPON.bodyDamage
    const headDmg = weaponDef ? weaponDef.headDamage : WEAPON.headDamage
    raycaster.set(originVec, dirVec)
    raycaster.far = far
    // Reutilizamos _targets: lo vaciamos y lo llenamos sin allocar.
    // Fase 8: broadphase — solo incluimos enemigos dentro del rango del
    // raycast. Antes se metían todos los enemigos vivos (hasta 456 meshes
    // en oleada 10) aunque estuvieran detrás del shooter o fuera de rango.
    _targets.length = 0
    const far2 = far * far
    for (const e of enemies) {
      if (e.dead) continue
      // Pre-check distancia al cuadrado (sin sqrt).
      const dx = e.group.position.x - originVec.x
      const dz = e.group.position.z - originVec.z
      if (dx * dx + dz * dz > far2) continue
      // Fase 1.3: además de head/helmet/torso/vest, incluimos stomach y
      // limbs como hit-targets con su propio multiplier de daño.
      _targets.push(e.head, e.helmet, e.torso, e.vest)
      if (e.stomach) _targets.push(e.stomach)
      for (const m of e.limbs) _targets.push(m)
    }
    const hits = raycaster.intersectObjects(_targets, false)
    if (hits.length === 0) return false

    const hit = hits[0]
    const enemy = hit.object.userData.enemy
    if (!enemy || enemy.dead) return false

    // Fase 1.3: daño por zona con multiplier.
    const part = hit.object.userData.part || 'chest'
    const isHead = part === 'head'
    // Daño base: head usa headDmg, resto usa bodyDmg.
    let dmg = isHead ? headDmg : bodyDmg
    // Multiplier por zona (head×4, neck×2, chest×1, stomach×1.1, limbs×0.8).
    // Nota: headDmg ya incluye el bonus de headshot del arma, así que para
    // head NO aplicamos el multiplier 4.0 adicional (evitaríamos doble bonus).
    if (!isHead) {
      const mul = DAMAGE_MULTIPLIERS[part] || 1.0
      dmg *= mul
    }

    // Fase 18.11: damage dropoff por rango.
    const distance = originVec.distanceTo(hit.point)
    const ranges = (weaponDef && weaponDef.damageRange) || DEFAULT_DAMAGE_RANGE
    const rangeMul = ranges.find((r) => distance >= r.min && distance < r.max)?.mul ?? 1.0
    dmg *= rangeMul

    // Fase 1.3: wallbang. Si hay un collider entre el origen y el punto
    // de impacto, el daño se reduce según el material (PENETRATION).
    let blockType = null
    if (world && world.colliders) {
      _wbRay.set(originVec, dirVec)
      let closestBlockDist = Infinity
      for (const c of world.colliders) {
        if (_wbRay.intersectBox(c.box, _wbPoint)) {
          const d = originVec.distanceTo(_wbPoint)
          if (d < closestBlockDist && d < hit.distance) {
            closestBlockDist = d
            blockType = c.type
          }
        }
      }
      if (blockType) {
        // El disparo atravesó un collider antes de golpear al enemigo.
        const penMul = PENETRATION[blockType] || 0.3
        dmg *= penMul
      }
    }

    enemy.hp -= dmg
    enemy.hitFlash = 0.12

    if (onHit) {
      _hitNormal.copy(dirVec).negate()
      _hitPoint.copy(hit.point)
      // Marcamos el tipo de impacto para el hitmarker (wallbang si penetró).
      const hitType = (blockType ? 'wallbang' : (isHead ? 'headshot' : part))
      onHit(enemy, isHead, _hitPoint, _hitNormal, hitType)
    }

    if (enemy.hp <= 0) killEnemy(enemy, enemy.points, dirVec)
    return true
  }

  function killEnemy(enemy, points = 0, impulseDir = null) {
    if (enemy.dead) return
    enemy.dead = true
    enemy.dyingT = 0
    enemy.hitFlash = 0
    // Apagamos el emissive inmediatamente para que el cadáver no brille.
    for (const m of enemy.materials) m.emissiveIntensity = 0
    // Ragdoll: simulación verlet sobre los huesos del humanoid para una
    // caída natural. Reemplaza la animación legacy de rotar+hundir.
    if (enemy.humanoid) {
      enemy.ragdoll = createRagdoll(enemy.humanoid, impulseDir)
    }
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
    // Ragdoll (Fase 1.2): liberamos la simulación verlet.
    if (e.ragdoll) { e.ragdoll.dispose(); e.ragdoll = null }
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
    // Fase 8: reusamos scratch vectors _wbRay/_wbPoint (antes allocaba por shot).
    const distToPlayer = Math.hypot(playerPos.x - _shootOrigin.x, playerPos.z - _shootOrigin.z)
    let blocked = false
    if (world && world.colliders) {
      _wbRay.set(_shootOrigin, _shootDir)
      for (const c of world.colliders) {
        if (_wbRay.intersectBox(c.box, _wbPoint)) {
          const d = _shootOrigin.distanceTo(_wbPoint)
          if (d < distToPlayer) { blocked = true; break }
        }
      }
    }
    if (blocked) return // sin línea de visión, no dispara.

    // Probabilidad de acierto: 60% base, reducida por distancia.
    // Fase 18.24: suppression reduce accuracy 50%.
    let hitChance = Math.max(0.2, 0.7 - distToPlayer * 0.01)
    if (e.ai && e.ai.suppressTimer > 0) hitChance *= 0.5
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

    // Fase 18.13: callback para suppression del jugador.
    if (onEnemyShootCb) onEnemyShootCb(_shootOrigin, _shootDir)

    // Si acierta, aplicamos daño via callback (engine registra takeDamage).
    if (hit && onShootPlayerCb) {
      onShootPlayerCb(e, e.damage)
    }
  }

  let onShootPlayerCb = null

  function update(dt, playerPos) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]

      // --- Muerte: ragdoll verlet durante 2.5s, luego se elimina ---
      if (e.dead) {
        e.dyingT = (e.dyingT || 0) + dt
        if (e.ragdoll) {
          // Step verlet (múltiples sub-steps para estabilidad con dt grande).
          const subSteps = 2
          const subDt = dt / subSteps
          for (let s = 0; s < subSteps; s++) {
            e.ragdoll.step(subDt, world)
          }
          e.ragdoll.apply()
        } else {
          // Sin ragdoll (fallback): animación legacy de caer+hundir.
          e.group.rotation.x = Math.min(Math.PI / 2, e.dyingT * 3)
          e.group.position.y = -e.dyingT * 0.4
        }
        if (e.dyingT > 2.5) {
          disposeEnemy(e)
          enemies.splice(i, 1)
        }
        continue
      }

      // --- IA táctica (Fase 1.2): state machine decide el waypoint ---
      const aiTarget = aiController.update(e, dt, playerPos)

      const dx = playerPos.x - e.group.position.x
      const dz = playerPos.z - e.group.position.z
      const dist = Math.hypot(dx, dz)

      // Vector de separación: empuja al enemigo lejos de sus vecinos.
      // Fase 8: optimizado con distancia al cuadrado (sin sqrt por par).
      // El radio de separación es 2.0, así que comprobamos dx²+dz² < 4.
      _sep.set(0, 0, 0)
      const epx = e.group.position.x, epz = e.group.position.z
      for (const other of enemies) {
        if (other === e || other.dead) continue
        const odx = epx - other.group.position.x
        const odz = epz - other.group.position.z
        const odist2 = odx * odx + odz * odz
        if (odist2 < 4.0 && odist2 > 0.0001) {
          const odist = Math.sqrt(odist2)
          const force = (2.0 - odist) / 2.0
          _sep.x += (odx / odist) * force
          _sep.z += (odz / odist) * force
        }
      }

      if (dist > 1.5) {
        const nx = dx / dist
        const nz = dz / dist
        // --- IA de disparo: enemigos ranged en estado SUPPRESS disparan ---
        const aiState = aiController.getState(e)
        const isSuppressing = aiState === 'suppress'
        const PREFERRED_RANGE = 20
        const inRange = e.isRanged && dist < PREFERRED_RANGE && dist > 5
        if (inRange && (isSuppressing || aiState === 'engage')) {
          e.shootCooldown -= dt
          if (e.shootCooldown <= 0) {
            e.shootCooldown = 1.0 + Math.random() * 1.5
            enemyShoot(e, playerPos)
            e.shotsFired = (e.shotsFired || 0) + 1
          }
        }

        // --- Movimiento hacia el target de la IA (o inmóvil si es null) ---
        if (aiTarget) {
          let moveX = aiTarget.x - e.group.position.x
          let moveZ = aiTarget.z - e.group.position.z
          const targetDist = Math.hypot(moveX, moveZ)
          if (targetDist > 0.5) {
            moveX = moveX / targetDist + _sep.x * 0.5
            moveZ = moveZ / targetDist + _sep.z * 0.5
          } else {
            moveX = _sep.x
            moveZ = _sep.z
          }

          // Wall-avoidance legacy (safety net para navmesh imperfecto).
          const moved = Math.hypot(e.group.position.x - e.lastX, e.group.position.z - e.lastZ)
          if (moved < e.speed * dt * 0.3) {
            e.stuckTime += dt
            if (e.stuckTime > 0.3) {
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

          e.walkPhase += dt * (e.speed * 1.6)
          e.currentSpeed = 1
          animateWalk(e.humanoid, e.walkPhase, 1)
        } else {
          // Inmóvil (SUPPRESS / TAKE_COVER / RELOAD): rota hacia el jugador.
          e.group.rotation.y = Math.atan2(nx, nz)
          animateWalk(e.humanoid, e.walkPhase, 0)
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
    // Fase 1.2: suprime un enemigo (fuego del jugador pasa cerca → cobertura).
    suppress(enemy) { aiController.suppress(enemy) },
    // Fase 1.2: suprime enemigos cercanos a un punto (ej. cerca de un disparo).
    suppressNear(point, radius) {
      for (const e of enemies) {
        if (e.dead) continue
        const d = Math.hypot(e.group.position.x - point.x, e.group.position.z - point.z)
        if (d <= radius) aiController.suppress(e)
      }
    },
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
    set onShootPlayer(fn) { onShootPlayerCb = fn },
    set onEnemyShoot(fn) { onEnemyShootCb = fn }
  }
}

// Exportamos ENEMY_TYPES y WAVE_SCALING para que engine.js pueda usarlos
// sin importarlos de config.js por separado (un solo punto de entrada).
export { ENEMY_TYPES, WAVE_SCALING }
