import * as THREE from 'three'

/* =========================================================================
   Ping system / ping wheel (Fase 18.54).
   --------------------------------------------------------------------------
   Sistema de pings contextuales para comunicación rápida en MP.
   - Tipos: default (amarillo), danger (rojo), enemy (rojo), loot (azul),
     goto (verde), defend (escudo).
   - Ping wheel: radial menu con 6 pings, se abre manteniendo Z.
   - Pings persisten 5s en el mundo + minimap.
   - World-space markers (sprite) + screen-space projection en HUD.

   Factory createPingSystem(scene, store) devuelve:
   - ping(worldPos, type, ownerId): crea ping en posición 3D.
   - update(dt, camera): tick de pings, projecta a screen-space.
   - getScreenPings(): lista de {x, y, type, dist} para HUD.
   - getMinimapPings(): lista de {x, z, type} para minimap.
   - openWheel(screenX, screenY): abre ping wheel.
   - closeWheel(): cierra wheel sin seleccionar.
   - selectWheelSlot(idx, ownerId): selecciona ping del wheel.
   - isWheelOpen(): estado del wheel.
   - reset() / dispose().
   ========================================================================= */

const PING_LIFETIME = 5.0
const WHEEL_SLOTS = 6

export const PING_TYPES = {
  default: { color: 0xffee00, label: 'Ping', icon: '◉' },
  danger: { color: 0xff3030, label: 'Danger', icon: '⚠' },
  enemy: { color: 0xff5050, label: 'Enemy', icon: '✖' },
  loot: { color: 0x4080ff, label: 'Loot', icon: '◇' },
  goto: { color: 0x40ff40, label: 'Go', icon: '→' },
  defend: { color: 0xffaa00, label: 'Defend', icon: '⛨' }
}

export const PING_WHEEL_ORDER = ['default', 'danger', 'enemy', 'loot', 'goto', 'defend']

export function createPingSystem(scene, _store) {
  const pings = []
  const group = new THREE.Group()
  scene.add(group)
  let wheelOpen = false
  let wheelPos = { x: 0, y: 0 }

  function makePingMarker(color) {
    const geo = new THREE.SphereGeometry(0.3, 12, 8)
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1.0
    })
    const mesh = new THREE.Mesh(geo, mat)
    return { mesh, mat }
  }

  function ping(worldPos, type = 'default', ownerId = null) {
    const cfg = PING_TYPES[type] || PING_TYPES.default
    const { mesh, mat } = makePingMarker(cfg.color)
    mesh.position.set(worldPos.x, worldPos.y + 1.5, worldPos.z)
    group.add(mesh)
    pings.push({
      mesh, mat,
      worldPos: { x: worldPos.x, y: worldPos.y + 1.5, z: worldPos.z },
      type, ownerId,
      createdAt: performance.now(),
      lifetime: PING_LIFETIME,
      screen: { x: 0, y: 0, visible: false, dist: 0 }
    })
  }

  function update(dt, camera) {
    const now = performance.now()
    for (let i = pings.length - 1; i >= 0; i--) {
      const p = pings[i]
      const elapsed = (now - p.createdAt) / 1000
      if (elapsed >= p.lifetime) {
        group.remove(p.mesh)
        p.mesh.geometry.dispose()
        p.mat.dispose()
        pings.splice(i, 1)
        continue
      }
      // Fade out en último segundo.
      const fadeStart = p.lifetime - 1.0
      if (elapsed > fadeStart) {
        p.mat.opacity = Math.max(0, 1.0 - (elapsed - fadeStart))
      } else {
        // Pulse.
        p.mat.opacity = 0.7 + Math.sin(elapsed * 6) * 0.3
      }
      // Projectar a screen-space.
      if (camera) {
        const v = new THREE.Vector3(p.worldPos.x, p.worldPos.y, p.worldPos.z)
        v.project(camera)
        const visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1
        p.screen.x = (v.x + 1) / 2
        p.screen.y = (1 - v.y) / 2
        p.screen.visible = visible
        // Distancia cámara-ping.
        const cx = camera.position.x - p.worldPos.x
        const cy = camera.position.y - p.worldPos.y
        const cz = camera.position.z - p.worldPos.z
        p.screen.dist = Math.sqrt(cx * cx + cy * cy + cz * cz)
      }
    }
  }

  function getScreenPings() {
    return pings.filter((p) => p.screen.visible).map((p) => ({
      x: p.screen.x, y: p.screen.y, type: p.type, dist: p.screen.dist
    }))
  }

  function getMinimapPings() {
    return pings.map((p) => ({ x: p.worldPos.x, z: p.worldPos.z, type: p.type }))
  }

  function openWheel(screenX, screenY) {
    wheelOpen = true
    wheelPos = { x: screenX, y: screenY }
  }

  function closeWheel() {
    wheelOpen = false
  }

  function selectWheelSlot(idx, ownerId = null) {
    if (idx < 0 || idx >= WHEEL_SLOTS) return null
    const type = PING_WHEEL_ORDER[idx]
    wheelOpen = false
    return { type, ownerId }
  }

  function isWheelOpen() { return wheelOpen }

  function getWheelPos() { return { ...wheelPos } }

  function reset() {
    for (const p of pings) {
      group.remove(p.mesh)
      p.mesh.geometry.dispose()
      p.mat.dispose()
    }
    pings.length = 0
    wheelOpen = false
  }

  function dispose() {
    reset()
    scene.remove(group)
  }

  return {
    ping, update, reset, dispose,
    getScreenPings, getMinimapPings,
    openWheel, closeWheel, selectWheelSlot, isWheelOpen, getWheelPos,
    get count() { return pings.length }
  }
}
