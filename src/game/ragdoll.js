import * as THREE from 'three'

/* =========================================================================
   Ragdoll — simulación verlet sobre los huesos del humanoid al morir.
   --------------------------------------------------------------------------
   Antes enemies.js al morir solo rotaba el grupo y lo hundía (parecía
   un maniquí cayendo, no un cuerpo). Ahora aplicamos verlet integration
   sobre los pivotes del humanoid (cadera, columna, cabeza, brazos, piernas)
   para que caiga de forma natural y se pliegue contra el suelo.

   Estrategia:
   - Capturamos las posiciones world de cada hueso al morir.
   - Las tratamos como partículas verlet (pos, prevPos).
   - Aplicamos gravedad + constraints de distancia (huesos rígidos).
   - Resolvemos contra el suelo (y >= 0) y contra colliders AABB.
   - Escribimos las posiciones resultantes de vuelta a los pivotes.
   - El root.group ya no rota; los huesos se mueven individualmente.

   Es una aproximación (no física real), pero visualmente convincente y
   barata (12-16 partículas por enemigo × N enemigos muriendo).
   ========================================================================= */

// Estructura de huesos: [boneName, parentIndex, restLength]
// Los índices corresponden al orden en que se llenan las partículas.
const BONE_STRUCTURE = [
  ['hips', -1, 0],      // 0
  ['spine', 0, 0.08],   // 1
  ['chest', 1, 0.22],   // 2
  ['neck', 2, 0.22],    // 3
  ['head', 3, 0.15],    // 4
  ['shoulderL', 2, 0.22], // 5
  ['elbowL', 5, 0.28],    // 6
  ['shoulderR', 2, 0.22], // 7
  ['elbowR', 7, 0.28],    // 8
  ['hipL', 0, 0.1],     // 9
  ['kneeL', 9, 0.36],   // 10
  ['hipR', 0, 0.1],     // 11
  ['kneeR', 11, 0.36]   // 12
]

// Crea un ragdoll a partir de un humanoid construido por buildHumanoid().
// Devuelve { step(dt, world), apply(), dispose() }.
export function createRagdoll(humanoid, impulseDir) {
  const particles = []
  const _worldPos = new THREE.Vector3()
  const _tmp = new THREE.Vector3()
  const _tmp2 = new THREE.Vector3()

  // 1. Capturamos posiciones world de cada hueso como partícula.
  for (const [boneName] of BONE_STRUCTURE) {
    const bone = humanoid[boneName]
    if (!bone) {
      particles.push({ pos: new THREE.Vector3(), prev: new THREE.Vector3() })
      continue
    }
    bone.getWorldPosition(_worldPos)
    const p = {
      pos: _worldPos.clone(),
      prev: _worldPos.clone(),
      pinned: false
    }
    particles.push(p)
  }

  // 2. Impulso inicial de muerte (la dirección del disparo empuja).
  if (impulseDir) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      const force = i === 4 ? 6 : 3 // la cabeza recibe más impulso
      p.prev.x -= impulseDir.x * force * 0.05
      p.prev.z -= impulseDir.z * force * 0.05
      p.prev.y -= 0.5
    }
  }

  // 3. step(dt): integra verlet + constraints + colisión suelo.
  function step(dt, world) {
    const gravity = 18
    const damping = 0.92
    // Integración verlet: pos += (pos - prev) * damping + gravity * dt^2
    for (const p of particles) {
      if (p.pinned) continue
      _tmp.copy(p.pos).sub(p.prev).multiplyScalar(damping)
      p.prev.copy(p.pos)
      p.pos.add(_tmp)
      p.pos.y -= gravity * dt * dt
    }
    // Constraints de distancia (huesos rígidos): 3 iteraciones.
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < BONE_STRUCTURE.length; i++) {
        const [, parentIdx, restLen] = BONE_STRUCTURE[i]
        if (parentIdx < 0) continue
        const a = particles[i]
        const b = particles[parentIdx]
        _tmp.subVectors(a.pos, b.pos)
        const d = _tmp.length()
        if (d < 0.0001) continue
        const diff = (d - restLen) / d * 0.5
        _tmp.multiplyScalar(diff)
        if (!a.pinned) a.pos.sub(_tmp)
        if (!b.pinned) b.pos.add(_tmp)
      }
      // Colisión suelo después de cada iteración.
      for (const p of particles) {
        if (p.pos.y < 0.05) {
          p.pos.y = 0.05
          // Fricción en el suelo.
          p.prev.x = p.pos.x + (p.prev.x - p.pos.x) * 0.7
          p.prev.z = p.pos.z + (p.prev.z - p.pos.z) * 0.7
        }
      }
      // Colisión contra colliders AABB del mundo (si hay world).
      if (world && world.forEachCollider) {
        for (const p of particles) {
          world.forEachCollider((c) => {
            const box = c.box
            if (p.pos.x > box.min.x - 0.3 && p.pos.x < box.max.x + 0.3 &&
                p.pos.z > box.min.z - 0.3 && p.pos.z < box.max.z + 0.3 &&
                p.pos.y > box.min.y && p.pos.y < box.max.y + 0.3) {
              // Empuja hacia afuera por el eje de menor penetración.
              const dxMin = p.pos.x - box.min.x
              const dxMax = box.max.x - p.pos.x
              const dzMin = p.pos.z - box.min.z
              const dzMax = box.max.z - p.pos.z
              const m = Math.min(dxMin, dxMax, dzMin, dzMax)
              if (m === dxMin) p.pos.x = box.min.x - 0.3
              else if (m === dxMax) p.pos.x = box.max.x + 0.3
              else if (m === dzMin) p.pos.z = box.min.z - 0.3
              else p.pos.z = box.max.z + 0.3
            }
          })
        }
      }
    }
  }

  // 4. apply(): escribe las posiciones de las partículas de vuelta a los huesos.
  // Convertimos world → local respecto al root del humanoid.
  function apply() {
    const root = humanoid.root
    for (let i = 0; i < BONE_STRUCTURE.length; i++) {
      const [boneName] = BONE_STRUCTURE[i]
      const bone = humanoid[boneName]
      if (!bone) continue
      const p = particles[i]
      // Posición local = worldPos - rootWorldPos (sin rotación: el root
      // queda horizontal y a y=0 tras la caída).
      _tmp.copy(p.pos)
      root.worldToLocal(_tmp)
      bone.position.copy(_tmp)
    }
  }

  function dispose() {
    particles.length = 0
  }

  return { step, apply, dispose }
}
