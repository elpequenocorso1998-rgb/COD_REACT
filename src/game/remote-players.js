import * as THREE from 'three'
import { buildHumanoid, animateWalk, disposeHumanoidShared } from './humanoid.js'

/* =========================================================================
   Remote players — renderiza otros jugadores en multijugador (Fase 2).
   --------------------------------------------------------------------------
   Mantiene un pool de humanoides (uno por jugador remoto) y los actualiza
   con interpolación entre snapshots del servidor. Reaprovecha el sistema
   de humanoid.js para que los jugadores remotos se vean igual que los bots.
   ========================================================================= */

export function createRemotePlayerManager(scene) {
  const remotes = new Map() // id -> { humanoid, group, lastPos, targetPos, lastYaw, targetYaw, walkPhase, firing, weapon }

  function ensurePlayer(id, team) {
    if (remotes.has(id)) return remotes.get(id)
    const humanoid = buildHumanoid()
    // Tinte por equipo: axis = rojo, allies = azul.
    const teamColor = team === 'axis' ? 0x6a2a2a : 0x2a3a5a
    const torsoMat = humanoid.torsoMesh.material.clone()
    torsoMat.color.setHex(teamColor)
    humanoid.torsoMesh.material = torsoMat
    const vestMat = humanoid.vestMesh.material.clone()
    vestMat.color.setHex(teamColor)
    humanoid.vestMesh.material = vestMat
    scene.add(humanoid.root)
    const entry = {
      humanoid,
      group: humanoid.root,
      materials: [torsoMat, vestMat],
      lastPos: new THREE.Vector3(),
      targetPos: new THREE.Vector3(),
      lastYaw: 0,
      targetYaw: 0,
      walkPhase: 0,
      firing: false,
      weapon: 'm4',
      team
    }
    remotes.set(id, entry)
    return entry
  }

  // Actualiza con un snapshot del servidor (lista de jugadores).
  // Interpola desde la posición anterior a la nueva.
  function updateSnapshot(players) {
    const seen = new Set()
    for (const p of players) {
      seen.add(p.id)
      const entry = ensurePlayer(p.id, p.team)
      entry.lastPos.copy(entry.targetPos)
      entry.targetPos.set(p.pos.x, p.pos.y, p.pos.z)
      entry.lastYaw = entry.targetYaw
      entry.targetYaw = p.yaw
      entry.firing = p.firing
      entry.weapon = p.weapon
      entry.alive = p.alive
      // Visibilidad: muertos ocultos.
      entry.group.visible = p.alive !== false
    }
    // Elimina jugadores que ya no están.
    for (const [id, entry] of remotes) {
      if (!seen.has(id)) {
        scene.remove(entry.group)
        for (const m of entry.materials) m.dispose()
        remotes.delete(id)
      }
    }
  }

  // Interpola y anima cada frame.
  const _tmp = new THREE.Vector3()
  function update(dt) {
    for (const entry of remotes.values()) {
      if (!entry.group.visible) continue
      // Interpolación de posición (lerp suave).
      entry.group.position.lerp(entry.targetPos, Math.min(1, dt * 10))
      // Interpolación de yaw.
      const yawDelta = entry.targetYaw - entry.lastYaw
      entry.group.rotation.y += yawDelta * Math.min(1, dt * 10)
      entry.lastYaw = entry.group.rotation.y
      // Animación de caminar: si se está moviendo, animateWalk.
      const movingDist = entry.lastPos.distanceTo(entry.targetPos)
      const moving = movingDist > 0.1
      if (moving) {
        entry.walkPhase += dt * 4
        animateWalk(entry.humanoid, entry.walkPhase, 1)
      } else {
        animateWalk(entry.humanoid, entry.walkPhase, 0)
      }
    }
  }

  function reset() {
    for (const entry of remotes.values()) {
      scene.remove(entry.group)
      for (const m of entry.materials) m.dispose()
    }
    remotes.clear()
  }

  function dispose() {
    reset()
    disposeHumanoidShared()
  }

  return { updateSnapshot, update, reset, dispose,
    get count() { return remotes.size },
    forEach(fn) { for (const entry of remotes.values()) fn(entry) }
  }
}
