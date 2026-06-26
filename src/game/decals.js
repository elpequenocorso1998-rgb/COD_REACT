import * as THREE from 'three'

/* =========================================================================
   Sistema de decals — marcas persistentes de impactos de bala y sangre.
   --------------------------------------------------------------------------
   - Decals de bala en paredes: pequeños círculos oscuros en el punto de
     impacto, orientados según la normal de la superficie.
   - Splatter de sangre en el suelo: manchas rojas persistentes.
   - Pool con límite: los decals más antiguos se eliminan al llegar al max,
     evitando crecimiento ilimitado de memoria.
   ========================================================================= */
export function createDecalSystem(scene, { maxDecals = 80 } = {}) {
  const decals = []
  // Geometría compartida: un plano pequeño (se reorienta por decal).
  const bulletGeo = new THREE.CircleGeometry(0.08, 8)
  const bloodGeo = new THREE.CircleGeometry(0.15, 8)
  // Materiales compartidos.
  const bulletMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a, transparent: true, opacity: 0.85,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  })
  const bloodMat = new THREE.MeshBasicMaterial({
    color: 0x6a1010, transparent: true, opacity: 0.8,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  })

  // Vectores scratch para orientación.
  const _pos = new THREE.Vector3()
  const _normal = new THREE.Vector3()
  const _quat = new THREE.Quaternion()
  const _up = new THREE.Vector3(0, 1, 0)

  // Añade un decal de impacto de bala en una pared.
  function spawnBulletHole(point, normal) {
    if (decals.length >= maxDecals) {
      // Elimina el decal más antiguo.
      const old = decals.shift()
      scene.remove(old.mesh)
    }
    _pos.copy(point)
    _normal.copy(normal).normalize()
    // Orientamos el plano perpendicular a la normal.
    _quat.setFromUnitVectors(_up, _normal)
    const mesh = new THREE.Mesh(bulletGeo, bulletMat)
    mesh.position.copy(_pos).addScaledVector(_normal, 0.01) // offset para evitar z-fighting
    mesh.quaternion.copy(_quat)
    // Variación de tamaño.
    const s = 0.7 + Math.random() * 0.6
    mesh.scale.setScalar(s)
    scene.add(mesh)
    decals.push({ mesh, time: 0, type: 'bullet' })
  }

  // Añade una mancha de sangre en el suelo.
  function spawnBloodSplat(point) {
    if (decals.length >= maxDecals) {
      const old = decals.shift()
      scene.remove(old.mesh)
    }
    const mesh = new THREE.Mesh(bloodGeo, bloodMat)
    mesh.position.copy(point)
    mesh.position.y = 0.02 // justo encima del suelo
    mesh.rotation.x = -Math.PI / 2 // tumbado en el suelo
    const s = 0.8 + Math.random() * 1.2
    mesh.scale.setScalar(s)
    scene.add(mesh)
    decals.push({ mesh, time: 0, type: 'blood' })
  }

  // Fade out gradual de los decals antiguos (los más viejos se desvanecen).
  function update(dt) {
    const FADE_START = 20 // segundos antes de empezar a desvanecer
    const FADE_DURATION = 5
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]
      d.time += dt
      if (d.time > FADE_START) {
        const fadeT = (d.time - FADE_START) / FADE_DURATION
        d.mesh.material.opacity = d.type === 'bullet' ? 0.85 * (1 - fadeT) : 0.8 * (1 - fadeT)
        if (fadeT >= 1) {
          scene.remove(d.mesh)
          decals.splice(i, 1)
        }
      }
    }
  }

  function reset() {
    for (const d of decals) scene.remove(d.mesh)
    decals.length = 0
  }

  function dispose() {
    reset()
    bulletGeo.dispose()
    bloodGeo.dispose()
    bulletMat.dispose()
    bloodMat.dispose()
  }

  return { spawnBulletHole, spawnBloodSplat, update, reset, dispose }
}
