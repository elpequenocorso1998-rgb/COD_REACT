import * as THREE from 'three'

/* =========================================================================
   Sistema de objetivos para modos PvP (Fase 18.34-37).
   --------------------------------------------------------------------------
   - Domination: 3 flags A/B/C, captura por proximidad, puntos por segundo.
   - Hardpoint: 1 hill rotatorio cada 60s, captura por proximidad.
   - Kill Confirmed: dog-tags dropeados al morir, recoger para confirmar.
   - Search & Destroy: bomb site A/B, plantar/desactivar.

   Factory createObjectiveSystem(scene, store) devuelve:
   - setup(modeId, world) → inicializa objetivos según modo.
   - update(dt, playerPos) → tick de capturas, rotación, timeouts.
   - onPlayerKill(victimId, killerId, position) → drop dog-tags (KC).
   - onPlayerEnterZone(zoneId, team) → captura de flag.
   - getZones() → lista de zonas activas (para HUD markers).
   - reset() / dispose().
   ========================================================================= */

const FLAG_COLORS = {
  neutral: 0x888888,
  axis: 0xb04040,
  allies: 0x4080c0
}

export function createObjectiveSystem(scene, store) {
  const zones = []
  const dogTags = []
  let mode = null
  let hillRotationTimer = 0
  let activeHillIndex = 0
  let group = new THREE.Group()
  scene.add(group)

  function setup(modeId, _world) {
    reset()
    mode = modeId
    if (modeId === 'domination') {
      const positions = [
        { id: 'A', x: -30, z: -30 },
        { id: 'B', x: 0, z: 0 },
        { id: 'C', x: 30, z: 30 }
      ]
      for (const p of positions) {
        zones.push(makeFlagZone(p.id, p.x, p.z))
      }
    } else if (modeId === 'hardpoint') {
      const hillPositions = [
        { id: 'H1', x: 0, z: 0 },
        { id: 'H2', x: -30, z: 30 },
        { id: 'H3', x: 30, z: -30 },
        { id: 'H4', x: 30, z: 30 },
        { id: 'H5', x: -30, z: -30 }
      ]
      for (const p of hillPositions) {
        zones.push(makeHillZone(p.id, p.x, p.z, false))
      }
      zones[0].active = true
      activeHillIndex = 0
      hillRotationTimer = 60
    } else if (modeId === 'killConfirmed') {
      // No zones; just dog-tag drops on kill.
    } else if (modeId === 'searchDestroy') {
      zones.push(makeBombSite('A', -15, -15))
      zones.push(makeBombSite('B', 15, 15))
    }
    for (const z of zones) group.add(z.mesh)
  }

  function makeFlagZone(id, x, z) {
    const geo = new THREE.CylinderGeometry(2, 2, 0.2, 24)
    const mat = new THREE.MeshStandardMaterial({
      color: FLAG_COLORS.neutral, emissive: FLAG_COLORS.neutral,
      emissiveIntensity: 0.3, transparent: true, opacity: 0.7
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 0.1, z)
    return {
      type: 'flag',
      id, x, z, radius: 3,
      mesh, mat,
      owner: null, // 'axis' | 'allies' | null
      capturingTeam: null,
      captureProgress: 0, // 0-100
      points: 0
    }
  }

  function makeHillZone(id, x, z, active) {
    const geo = new THREE.CylinderGeometry(4, 4, 0.2, 32)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc40, emissive: 0xffcc40,
      emissiveIntensity: active ? 0.5 : 0.05,
      transparent: true, opacity: active ? 0.6 : 0.15
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 0.1, z)
    mesh.visible = active
    return {
      type: 'hill',
      id, x, z, radius: 5,
      mesh, mat,
      active,
      capturingTeam: null,
      captureProgress: 0,
      points: 0
    }
  }

  function makeBombSite(id, x, z) {
    const geo = new THREE.BoxGeometry(4, 0.4, 4)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff6020, emissive: 0xff6020, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.5
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x, 0.2, z)
    return {
      type: 'bombsite',
      id, x, z, radius: 3,
      mesh, mat,
      bombPlanted: false,
      bombPlanter: null,
      plantProgress: 0,
      defuseProgress: 0,
      bombTimer: 0
    }
  }

  function makeDogTag(victimId, team, position) {
    const geo = new THREE.BoxGeometry(0.4, 0.05, 0.3)
    const mat = new THREE.MeshStandardMaterial({
      color: team === 'axis' ? 0xb04040 : 0x4080c0,
      emissive: 0xffffff, emissiveIntensity: 0.3
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(position.x, 0.5, position.z)
    group.add(mesh)
    return {
      type: 'dogtag',
      victimId,
      team,
      mesh, mat,
      expire: 30,
      confirmed: false
    }
  }

  function update(dt, playerPos, remotePlayers) {
    // Captura de flags/hills por proximidad.
    for (const z of zones) {
      if (z.type === 'flag') updateFlag(z, dt, playerPos, remotePlayers)
      else if (z.type === 'hill' && z.active) updateHill(z, dt, playerPos, remotePlayers)
      else if (z.type === 'bombsite' && z.bombPlanted) updateBomb(z, dt)
    }
    // Rotación de hardpoint.
    if (mode === 'hardpoint') {
      hillRotationTimer -= dt
      if (hillRotationTimer <= 0) {
        zones[activeHillIndex].active = false
        zones[activeHillIndex].mesh.visible = false
        zones[activeHillIndex].mat.emissiveIntensity = 0.05
        zones[activeHillIndex].mat.opacity = 0.15
        activeHillIndex = (activeHillIndex + 1) % zones.length
        zones[activeHillIndex].active = true
        zones[activeHillIndex].mesh.visible = true
        zones[activeHillIndex].mat.emissiveIntensity = 0.5
        zones[activeHillIndex].mat.opacity = 0.6
        hillRotationTimer = 60
        if (store) store.getState().setObjectiveNotice?.(`Hill moved to ${zones[activeHillIndex].id}`)
      }
    }
    // Dog-tags: expiración.
    for (let i = dogTags.length - 1; i >= 0; i--) {
      const t = dogTags[i]
      t.expire -= dt
      if (t.expire <= 0 || t.confirmed) {
        group.remove(t.mesh)
        t.geo?.dispose(); t.mat.dispose()
        dogTags.splice(i, 1)
      }
    }
  }

  function updateFlag(zone, dt, playerPos, remotePlayers) {
    // Cuenta de jugadores de cada team en zona.
    let axis = 0, allies = 0
    if (playerPos) {
      const dx = playerPos.x - zone.x
      const dz = playerPos.z - zone.z
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        // Equipo del jugador local (asumimos allies si no hay team).
        const t = (store && store.getState().mpTeam) || 'allies'
        if (t === 'axis') axis++
        else allies++
      }
    }
    if (remotePlayers) {
      for (const p of remotePlayers.values()) {
        if (!p.alive || !p.pos) continue
        const dx = p.pos.x - zone.x
        const dz = p.pos.z - zone.z
        if (dx * dx + dz * dz <= zone.radius * zone.radius) {
          if (p.team === 'axis') axis++
          else allies++
        }
      }
    }
    // Captura: si un team tiene mayoría y el otro no, progresa.
    const dominant = axis > allies ? 'axis' : (allies > axis ? 'allies' : null)
    if (dominant) {
      if (zone.owner !== dominant) {
        zone.captureProgress = Math.min(100, zone.captureProgress + dt * 30)
        if (zone.captureProgress >= 100) {
          zone.owner = dominant
          zone.mat.color.setHex(FLAG_COLORS[dominant])
          zone.mat.emissive.setHex(FLAG_COLORS[dominant])
          if (store) store.getState().setObjectiveNotice?.(`Flag ${zone.id} captured by ${dominant}`)
        }
      } else {
        // Ya capturada: +1 punto por segundo al equipo.
        zone.points += dt
        if (zone.points >= 1) {
          zone.points -= 1
          if (store) store.getState().awardObjectivePoint?.(dominant, 1)
        }
      }
    } else if (zone.owner && axis === 0 && allies === 0) {
      // Sin contender: la captura no decae pero no progresa.
    }
  }

  function updateHill(zone, dt, playerPos, remotePlayers) {
    let axis = 0, allies = 0
    if (playerPos) {
      const dx = playerPos.x - zone.x
      const dz = playerPos.z - zone.z
      if (dx * dx + dz * dz <= zone.radius * zone.radius) {
        const t = (store && store.getState().mpTeam) || 'allies'
        if (t === 'axis') axis++
        else allies++
      }
    }
    if (remotePlayers) {
      for (const p of remotePlayers.values()) {
        if (!p.alive || !p.pos) continue
        const dx = p.pos.x - zone.x
        const dz = p.pos.z - zone.z
        if (dx * dx + dz * dz <= zone.radius * zone.radius) {
          if (p.team === 'axis') axis++
          else allies++
        }
      }
    }
    const dominant = axis > allies ? 'axis' : (allies > axis ? 'allies' : null)
    if (dominant) {
      zone.points += dt * (axis + allies)
      if (zone.points >= 1) {
        const pts = Math.floor(zone.points)
        zone.points -= pts
        if (store) store.getState().awardObjectivePoint?.(dominant, pts)
      }
    }
  }

  function updateBomb(zone, dt) {
    if (zone.bombPlanted && zone.bombTimer > 0) {
      zone.bombTimer -= dt
      if (zone.bombTimer <= 0) {
        // Bomba explota → atacantes ganan el round.
        if (store) store.getState().setObjectiveNotice?.('Bomb detonated!')
      }
    }
  }

  function onPlayerKill(victimId, killerId, position, victimTeam) {
    if (mode !== 'killConfirmed') return
    if (!position) return
    const tag = makeDogTag(victimId, victimTeam, position)
    dogTags.push(tag)
  }

  function tryCollectDogTag(playerPos, playerTeam) {
    if (mode !== 'killConfirmed') return null
    for (const t of dogTags) {
      if (t.confirmed) continue
      const dx = playerPos.x - t.mesh.position.x
      const dz = playerPos.z - t.mesh.position.z
      if (dx * dx + dz * dz <= 2 * 2) {
        // Solo se confirman dog-tags del equipo enemigo.
        if (t.team !== playerTeam) {
          t.confirmed = true
          return { victimId: t.victimId, team: t.team }
        }
      }
    }
    return null
  }

  function tryPlantBomb(playerPos, playerTeam, dt) {
    if (mode !== 'searchDestroy') return false
    for (const z of zones) {
      if (z.type !== 'bombsite' || z.bombPlanted) continue
      const dx = playerPos.x - z.x
      const dz = playerPos.z - z.z
      if (dx * dx + dz * dz <= z.radius * z.radius) {
        z.plantProgress += dt * 100 / 5 // 5s para plantar
        if (z.plantProgress >= 100) {
          z.bombPlanted = true
          z.bombPlanter = playerTeam
          z.bombTimer = 45
          if (store) store.getState().setObjectiveNotice?.(`Bomb planted at ${z.id}`)
          return true
        }
      }
    }
    return false
  }

  function tryDefuseBomb(playerPos, dt) {
    if (mode !== 'searchDestroy') return false
    for (const z of zones) {
      if (z.type !== 'bombsite' || !z.bombPlanted) continue
      const dx = playerPos.x - z.x
      const dz = playerPos.z - z.z
      if (dx * dx + dz * dz <= z.radius * z.radius) {
        z.defuseProgress += dt * 100 / 7 // 7s para desactivar
        if (z.defuseProgress >= 100) {
          z.bombPlanted = false
          z.bombTimer = 0
          if (store) store.getState().setObjectiveNotice?.(`Bomb defused at ${z.id}`)
          return true
        }
      }
    }
    return false
  }

  function reset() {
    for (const z of zones) {
      group.remove(z.mesh)
      z.mesh.geometry.dispose()
      z.mat.dispose()
    }
    zones.length = 0
    for (const t of dogTags) {
      group.remove(t.mesh)
      t.mat.dispose()
    }
    dogTags.length = 0
    hillRotationTimer = 0
    activeHillIndex = 0
  }

  function dispose() {
    reset()
    scene.remove(group)
    group = null
  }

  return {
    setup, update, reset, dispose,
    onPlayerKill, tryCollectDogTag, tryPlantBomb, tryDefuseBomb,
    getZones: () => zones,
    getDogTags: () => dogTags,
    getMode: () => mode
  }
}
