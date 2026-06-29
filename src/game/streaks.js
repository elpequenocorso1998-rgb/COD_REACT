import * as THREE from 'three'

/* =========================================================================
   Killstreaks — efectos de rachas de bajas estilo Call of Duty.
   --------------------------------------------------------------------------
   - UAV (3 kills): handled by store.uavActive (minimap reveal). Nada que
     hacer aquí; el minimap lee el flag.
   - Airstrike (5 kills): bombardea una zona aleatoria cercana a los
     enemigos con retardo. Daño en área.
   - Attack Heli (7 kills): spawnea un helicóptero aliado que orbita sobre
     el mapa y dispara a enemigos durante 60s.
   - Gunship (11 kills): cámara aérea temporal; click = disparo de cañón
     que mata al instante en el punto clickado.
   ========================================================================= */

export function createStreakManager(scene, enemies, particles, audio, player, camera, store) {
  // --- Airstrike ---
  // Spawnea explosiones en una zona con retardo escalonado.
  function airstrike(playerPos) {
    if (!enemies || !audio) return
    audio.playAirstrike?.()
    // Encontramos el centroide de los enemigos vivos para bombardear ahí.
    let cx = 0, cz = 0, n = 0
    enemies.forEachAlive((pos) => { cx += pos.x; cz += pos.z; n++ })
    if (n === 0) {
      // Sin enemigos: bombardeamos cerca del jugador.
      cx = playerPos.x; cz = playerPos.z
    } else { cx /= n; cz /= n }
    // 8 explosiones escalonadas en un radio de 20u alrededor del centroide.
    for (let i = 0; i < 8; i++) {
      const delay = i * 300
      setTimeout(() => {
        const ang = Math.random() * Math.PI * 2
        const r = Math.random() * 20
        const x = cx + Math.cos(ang) * r
        const z = cz + Math.sin(ang) * r
        explosionAt(x, z, 6, 40)
      }, delay)
    }
  }

  // Explosión en (x,z): daño a enemigos en radio + partículas + sonido.
  const _explosionPos = new THREE.Vector3()
  function explosionAt(x, z, radius, damage) {
    _explosionPos.set(x, 1, z)
    if (particles) {
      // Chispas + humo.
      particles.spawnSparks(_explosionPos, new THREE.Vector3(0, 1, 0))
      particles.spawnSmoke(_explosionPos, 5)
    }
    if (audio) audio.playExplosion?.()
    // Daño a enemigos en radio.
    if (enemies) {
      enemies.forEachAlive((pos, typeName, _lastShot, e) => {
        const d = Math.hypot(pos.x - x, pos.z - z)
        if (d <= radius) {
          e.hp -= damage
          e.hitFlash = 0.12
          if (e.hp <= 0) {
            // Reusamos el callback de kill del engine via onKilled.
            // No tenemos acceso directo, pero el enemy manager lo gestiona
            // en su update. Marcamos dead y dejamos que update lo procese.
            e.dead = true
            e.dyingT = 0
          }
        }
      })
    }
  }

  // --- Attack Helicopter ---
  // Heli aliado que orbita y dispara a enemigos. Lo modelamos como un mesh
  // simple que orbita + un timer que dispara a enemigos cercanos.
  let heliMesh = null
  let heliLight = null
  let heliRotorGeo = null
  let heliRotorMat = null
  let heliUntil = 0
  const _heliPos = new THREE.Vector3()

  function spawnHeli() {
    if (heliMesh) return
    const geo = new THREE.ConeGeometry(2, 6, 8)
    geo.rotateZ(Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, metalness: 0.8, roughness: 0.3 })
    heliMesh = new THREE.Mesh(geo, mat)
    heliMesh.position.set(0, 30, 0)
    scene.add(heliMesh)
    // Rotor (disco plano).
    // Fase 7: guardamos geo/mat del rotor para disposal correcto (antes leak).
    heliRotorGeo = new THREE.CylinderGeometry(4, 4, 0.1, 16)
    heliRotorMat = new THREE.MeshStandardMaterial({ color: 0x111111, transparent: true, opacity: 0.4 })
    const rotor = new THREE.Mesh(heliRotorGeo, heliRotorMat)
    rotor.position.y = 0.5
    heliMesh.add(rotor)
    heliLight = new THREE.PointLight(0xffaa44, 0, 30, 2)
    scene.add(heliLight)
    heliUntil = performance.now() + 60000
    if (audio) audio.playHeliIncoming?.()
  }

  let heliAngle = 0
  let heliShootTimer = 0
  function updateHeli(dt, playerPos) {
    if (!heliMesh) return
    const now = performance.now()
    if (now > heliUntil) {
      // Expira: remover.
      // Fase 7: dispose del rotor (antes solo se disposaba el heliMesh).
      scene.remove(heliMesh)
      heliMesh.geometry.dispose()
      heliMesh.material.dispose()
      if (heliRotorGeo) { heliRotorGeo.dispose(); heliRotorGeo = null }
      if (heliRotorMat) { heliRotorMat.dispose(); heliRotorMat = null }
      heliMesh = null
      if (heliLight) { scene.remove(heliLight); heliLight = null }
      return
    }
    // Orbita sobre el jugador a 40u de radio, 30u de altura.
    heliAngle += dt * 0.5
    _heliPos.set(
      playerPos.x + Math.cos(heliAngle) * 40,
      30,
      playerPos.z + Math.sin(heliAngle) * 40
    )
    heliMesh.position.copy(_heliPos)
    heliMesh.rotation.y = -heliAngle + Math.PI / 2
    // Dispara al enemigo más cercano cada 0.5s.
    heliShootTimer -= dt
    if (heliShootTimer <= 0) {
      heliShootTimer = 0.5
      let nearest = null, nearestD = Infinity
      enemies.forEachAlive((pos, _t, _ls, e) => {
        const d = Math.hypot(pos.x - _heliPos.x, pos.z - _heliPos.z)
        if (d < nearestD && d < 60) { nearestD = d; nearest = e }
      })
      if (nearest) {
        nearest.hp -= 25
        nearest.hitFlash = 0.12
        if (nearest.hp <= 0) {
          nearest.dead = true
          nearest.dyingT = 0
        }
        if (audio) audio.playHeliShoot?.()
        // Tracer visual: chispas en el enemigo.
        const ep = nearest.group.position
        particles.spawnSparks(new THREE.Vector3(ep.x, 1, ep.z), new THREE.Vector3(0, 1, 0))
      }
    }
  }

  // --- Gunship ---
  // Cámara aérea: el jugador ve el mapa desde arriba y click = disparo.
  let gunshipActive = false
  let savedCameraPos = null
  let savedCameraQuat = null

  function startGunship() {
    if (gunshipActive) return
    gunshipActive = true
    savedCameraPos = camera.position.clone()
    savedCameraQuat = camera.quaternion.clone()
    // Avisamos al store para que player.update skipa la cámara.
    // Bug fixed: antes player.update sobrescribía la posición/rotación
    // de la cámara cada frame, destruyendo la vista aérea del gunship.
    if (store) store.getState().setGunshipActive(true)
    if (player && player.setGunshipActive) player.setGunshipActive(true)
    // Cámara aérea mirando hacia abajo.
    camera.position.set(player.getPosition().x, 80, player.getPosition().z)
    camera.lookAt(player.getPosition().x, 0, player.getPosition().z)
    if (audio) audio.playGunshipIncoming?.()
    // Auto-expira tras 30s.
    setTimeout(() => endGunship(), 30000)
  }

  function endGunship() {
    if (!gunshipActive) return
    gunshipActive = false
    if (store) store.getState().setGunshipActive(false)
    if (player && player.setGunshipActive) player.setGunshipActive(false)
    if (savedCameraPos) camera.position.copy(savedCameraPos)
    if (savedCameraQuat) camera.quaternion.copy(savedCameraQuat)
    savedCameraPos = null
    savedCameraQuat = null
  }

  // Click durante gunship = disparo de cañón en el punto del suelo.
  function gunshipShootAt(worldPoint) {
    explosionAt(worldPoint.x, worldPoint.z, 8, 100)
  }

  // --- Update general (llamado cada frame desde engine) ---
  function update(dt, playerPos) {
    updateHeli(dt, playerPos)
  }

  // Activa un streak por tipo (llamado cuando el jugador pulsa la tecla).
  function activate(type, playerPos) {
    switch (type) {
      case 'uav': return // UAV solo activa uavActive en el store.
      case 'airstrike': airstrike(playerPos); break
      case 'heli': spawnHeli(); break
      case 'gunship': startGunship(); break
    }
  }

  function isGunshipActive() { return gunshipActive }

  function dispose() {
    endGunship()
    if (heliMesh) {
      scene.remove(heliMesh)
      heliMesh.geometry.dispose()
      heliMesh.material.dispose()
      // Fase 7: dispose del rotor (antes leak).
      if (heliRotorGeo) { heliRotorGeo.dispose(); heliRotorGeo = null }
      if (heliRotorMat) { heliRotorMat.dispose(); heliRotorMat = null }
      heliMesh = null
    }
    if (heliLight) { scene.remove(heliLight); heliLight = null }
  }

  return { update, activate, gunshipShootAt, isGunshipActive, dispose }
}
