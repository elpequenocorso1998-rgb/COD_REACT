import * as THREE from 'three'

/* =========================================================================
   Sistema de partículas.
   --------------------------------------------------------------------------
   Pequeño pool reutilizable para efectos efímeros: sangre al impactar
   enemigos, casquillos al disparar, humo del muzzle flash.
   Cada partícula es un mesh con física simple (gravedad, fricción, vida).

   Mejoras:
   - Cada partícula tiene SU PROPIO material clonado para que el fade de
     opacity no afecte a las demás (bug fixed: antes todas las partículas
     de humo compartían opacidad).
   - Free-list O(1) para adquirir partículas en lugar de un scan lineal.
   - dispose() limpia geometría y materiales.
   ========================================================================= */
export function createParticleSystem(scene, { max = 200 } = {}) {
  // Geometría y materiales BASE compartidos (para clonar).
  const geo = new THREE.SphereGeometry(0.05, 6, 6)
  const matBloodBase = new THREE.MeshBasicMaterial({ color: 0xaa1010 })
  const matSparkBase = new THREE.MeshBasicMaterial({ color: 0xffcc44 })
  const matSmokeBase = new THREE.MeshBasicMaterial({
    color: 0x444444, transparent: true, opacity: 0.6
  })
  // Color hex constante por tipo para swap rápido con setHex (sin copy()).
  const BLOOD_HEX = 0xaa1010
  const SPARK_HEX = 0xffcc44
  const SMOKE_HEX = 0x444444

  const pool = [] // { mesh, vel, life, maxLife, gravity, fade, scaleRate, material }
  const freeList = [] // índices libres para adquisición O(1)
  // Scratch Vector3 reutilizado para direcciones (antes spawn hacía
  // normalDirection.clone() por partícula: ~25 alloc/disparo).
  const _scratchDir = new THREE.Vector3()

  // Pre-creamos el pool oculto. Cada partícula tiene su propio material
  // clonado para que el fade de opacidad sea independiente.
  for (let i = 0; i < max; i++) {
    // Empezamos con un clon de sangre; se swap-ea al adquirir.
    const m = new THREE.Mesh(geo, matBloodBase.clone())
    m.visible = false
    scene.add(m)
    pool.push({
      mesh: m,
      vel: new THREE.Vector3(),
      life: 0, maxLife: 1, gravity: 0, fade: false, scaleRate: 0,
      active: false,
      _idx: i // índice en el pool para release O(1) (antes usaba indexOf O(n))
    })
    freeList.push(i)
  }

  // Toma una partícula inactiva del pool en O(1).
  function acquire() {
    if (freeList.length === 0) return null
    const idx = freeList.pop()
    const p = pool[idx]
    p.active = true
    return p
  }

  // Libera una partícula al final de su vida. O(1) usando _idx
  // (antes era pool.indexOf(p) → O(n) con hasta 62k comparaciones/seg).
  function release(p) {
    if (!p.active) return
    p.active = false
    p.mesh.visible = false
    freeList.push(p._idx)
  }

  // ---------------------------------------------------------------------
  // Sangre: explosión de partículas rojas con gravedad.
  // ---------------------------------------------------------------------
  function spawnBlood(position, normalDirection) {
    const count = 12
    for (let i = 0; i < count; i++) {
      const p = acquire()
      if (!p) return
      // Swap rápido de color por tipo con setHex (sin material.copy()).
      p.mesh.material.color.setHex(BLOOD_HEX)
      p.mesh.material.transparent = false
      p.mesh.material.opacity = 1
      p.mesh.position.copy(position)
      p.mesh.scale.setScalar(0.6 + Math.random() * 0.8)
      p.mesh.visible = true
      // Velocidad: dirección del impacto + dispersión esférica.
      _scratchDir.copy(normalDirection).multiplyScalar(2 + Math.random() * 3)
      _scratchDir.x += (Math.random() - 0.5) * 4
      _scratchDir.y += Math.random() * 3
      _scratchDir.z += (Math.random() - 0.5) * 4
      p.vel.copy(_scratchDir)
      p.life = 0
      p.maxLife = 0.8 + Math.random() * 0.4
      p.gravity = 9.8
      p.fade = false
      p.scaleRate = -0.5
    }
  }

  // ---------------------------------------------------------------------
  // Chispas: pequeños destellos amarillos al impactar paredes/suelo.
  // ---------------------------------------------------------------------
  function spawnSparks(position, normalDirection) {
    const count = 8
    for (let i = 0; i < count; i++) {
      const p = acquire()
      if (!p) return
      p.mesh.material.color.setHex(SPARK_HEX)
      p.mesh.material.transparent = false
      p.mesh.material.opacity = 1
      p.mesh.position.copy(position)
      p.mesh.scale.setScalar(0.3 + Math.random() * 0.4)
      p.mesh.visible = true
      _scratchDir.copy(normalDirection).multiplyScalar(3 + Math.random() * 3)
      _scratchDir.x += (Math.random() - 0.5) * 3
      _scratchDir.y += 1 + Math.random() * 2
      _scratchDir.z += (Math.random() - 0.5) * 3
      p.vel.copy(_scratchDir)
      p.life = 0
      p.maxLife = 0.4 + Math.random() * 0.2
      p.gravity = 9.8
      p.fade = false
      p.scaleRate = -1
    }
  }

  // ---------------------------------------------------------------------
  // Humo: opaco, crece y se desvanece.
  // ---------------------------------------------------------------------
  function spawnSmoke(position, count = 1) {
    for (let i = 0; i < count; i++) {
      const p = acquire()
      if (!p) return
      p.mesh.material.color.setHex(SMOKE_HEX)
      p.mesh.material.transparent = true
      p.mesh.material.opacity = 0.6
      p.mesh.position.copy(position)
      p.mesh.position.x += (Math.random() - 0.5) * 0.2
      p.mesh.position.y += (Math.random() - 0.5) * 0.2
      p.mesh.position.z += (Math.random() - 0.5) * 0.2
      p.mesh.scale.setScalar(0.5)
      p.mesh.visible = true
      p.vel.set((Math.random() - 0.5) * 0.5, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5)
      p.life = 0
      p.maxLife = 1.5 + Math.random() * 0.5
      p.gravity = -0.5 // sube (gravedad negativa)
      p.fade = true
      p.scaleRate = 2 // crece
    }
  }

  // ---------------------------------------------------------------------
  // Muzzle flash burst: explosión corta de chispas amarillas + humo.
  // Para disparos del jugador.
  // ---------------------------------------------------------------------
  function spawnMuzzleBurst(position, direction) {
    // Chispas hacia adelante.
    for (let i = 0; i < 5; i++) {
      const p = acquire()
      if (!p) return
      p.mesh.material.color.setHex(SPARK_HEX)
      p.mesh.material.transparent = false
      p.mesh.material.opacity = 1
      p.mesh.position.copy(position)
      p.mesh.scale.setScalar(0.2 + Math.random() * 0.2)
      p.mesh.visible = true
      _scratchDir.copy(direction).multiplyScalar(4 + Math.random() * 3)
      _scratchDir.x += (Math.random() - 0.5) * 2
      _scratchDir.y += (Math.random() - 0.5) * 2
      _scratchDir.z += (Math.random() - 0.5) * 2
      p.vel.copy(_scratchDir)
      p.life = 0
      p.maxLife = 0.15 + Math.random() * 0.1
      p.gravity = 0
      p.fade = false
      p.scaleRate = -2
    }
    // Humo leve.
    spawnSmoke(position, 1)
  }

  // ---------------------------------------------------------------------
  // UPDATE: integra física y vida de todas las partículas activas.
  // ---------------------------------------------------------------------
  function update(dt) {
    for (const p of pool) {
      if (!p.active) continue
      p.life += dt
      if (p.life >= p.maxLife) {
        release(p)
        continue
      }
      // Gravedad
      p.vel.y -= p.gravity * dt
      // Movimiento
      p.mesh.position.addScaledVector(p.vel, dt)
      // Suelo: si toca el suelo, frena y se asienta
      if (p.mesh.position.y < 0.05) {
        p.mesh.position.y = 0.05
        p.vel.x *= 0.6; p.vel.z *= 0.6; p.vel.y = 0
      }
      // Escala
      const s = p.mesh.scale.x + p.scaleRate * dt
      p.mesh.scale.setScalar(Math.max(0.05, s))
      // Fade: ahora cada partícula tiene su propio material, así que
      // modificar opacity solo afecta a esta partícula.
      if (p.fade) {
        p.mesh.material.opacity = (1 - (p.life / p.maxLife)) * 0.6
      }
    }
  }

  function reset() {
    for (const p of pool) {
      p.active = false
      p.mesh.visible = false
    }
    freeList.length = 0
    for (let i = 0; i < pool.length; i++) freeList.push(i)
  }

  function dispose() {
    for (const p of pool) {
      p.mesh.material.dispose()
      scene.remove(p.mesh)
    }
    geo.dispose()
    matBloodBase.dispose()
    matSparkBase.dispose()
    matSmokeBase.dispose()
    pool.length = 0
    freeList.length = 0
  }

  // Fase 19.11: polvo ambiental (partículas flotantes en haces de sol).
  function spawnAmbientDust(position) {
    const p = acquire()
    if (!p) return
    p.mesh.material.color.setHex(0xddddaa)
    p.mesh.material.transparent = true
    p.mesh.material.opacity = 0.15 + Math.random() * 0.15
    p.mesh.position.copy(position)
    p.mesh.position.x += (Math.random() - 0.5) * 20
    p.mesh.position.y += Math.random() * 5
    p.mesh.position.z += (Math.random() - 0.5) * 20
    p.mesh.scale.setScalar(0.04 + Math.random() * 0.03)
    p.mesh.visible = true
    p.vel.set(
      (Math.random() - 0.5) * 0.2,
      0.1 + Math.random() * 0.2,
      (Math.random() - 0.5) * 0.2
    )
    p.life = 4 + Math.random() * 3
    p.maxLife = p.life
    p.fade = true
    p.gravity = false
  }

  // Fase 19.11: humo distante (columnas en el horizonte).
  function spawnDistantSmoke(position) {
    for (let i = 0; i < 3; i++) {
      const p = acquire()
      if (!p) return
      p.mesh.material.color.setHex(SMOKE_HEX)
      p.mesh.material.transparent = true
      p.mesh.material.opacity = 0.3
      p.mesh.position.copy(position)
      p.mesh.position.x += (Math.random() - 0.5) * 3
      p.mesh.position.y += i * 2
      p.mesh.position.z += (Math.random() - 0.5) * 3
      p.mesh.scale.setScalar(2 + i * 0.5)
      p.mesh.visible = true
      p.vel.set(0, 0.5 + Math.random() * 0.3, 0)
      p.life = 8 + Math.random() * 4
      p.maxLife = p.life
      p.fade = true
      p.gravity = false
    }
  }

  return { spawnBlood, spawnSparks, spawnSmoke, spawnMuzzleBurst, spawnAmbientDust, spawnDistantSmoke, update, reset, dispose }
}
