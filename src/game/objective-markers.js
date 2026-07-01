/* =========================================================================
   Objective markers HUD (Fase 18.55).
   --------------------------------------------------------------------------
   Proyecta posiciones 3D de objetivos (flags, hills, bomb sites) a
   screen-space para mostrar markers en el HUD con:
   - Distancia al objetivo.
   - Capture progress ring.
   - Off-screen direction arrows.
   - Color por equipo dueño / tipo.

   Factory createObjectiveMarkers(camera, viewport) devuelve:
   - update(zones, playerPos): calcula screen pos de cada zone.
   - getMarkers(): lista de { id, screenX, screenY, dist, type, owner,
     captureProgress, offScreen, arrowAngle }.
   - setViewport(w, h): actualiza dimensiones del viewport.
   ========================================================================= */

export function createObjectiveMarkers(camera, viewport = { w: 1, h: 1 }) {
  let markers = []
  let vp = { ...viewport }

  function setViewport(w, h) {
    vp = { w: Math.max(1, w), h: Math.max(1, h) }
  }

  function projectToScreen(worldPos) {
    if (!camera) return { x: 0, y: 0, visible: false, dist: 0 }
    const v = camera.worldToLocal
      ? { x: worldPos.x - camera.position.x, y: worldPos.y - camera.position.y, z: worldPos.z - camera.position.z }
      : { x: 0, y: 0, z: 0 }
    // Distancia camera-zone.
    const dx = camera.position.x - worldPos.x
    const dy = camera.position.y - worldPos.y
    const dz = camera.position.z - worldPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    // Project simple: si el zone está delante de la cámara, calculamos
    // su posición en pantalla usando el frustum.
    const camDir = camera.getWorldDirection ? camera.getWorldDirection() : { x: 0, y: 0, z: -1 }
    const forwardDot = v.x * camDir.x + v.y * camDir.y + v.z * camDir.z
    if (forwardDot <= 0) {
      // Detrás de la cámara.
      return { x: 0, y: 0, visible: false, dist, behindCamera: true }
    }
    // Proyección simple: calcular ángulos relativos al FOV.
    const fov = camera.fov ? camera.fov * Math.PI / 180 : Math.PI / 4
    const aspect = vp.w / vp.h
    // Vector right y up de la cámara.
    const right = camera.getWorldDirection ? cross(camDir, { x: 0, y: 1, z: 0 }) : { x: 1, y: 0, z: 0 }
    const up = cross(right, camDir)
    const rightDot = v.x * right.x + v.y * right.y + v.z * right.z
    const upDot = v.x * up.x + v.y * up.y + v.z * up.z
    const tanHalfFov = Math.tan(fov / 2)
    const screenX = 0.5 + (rightDot / (forwardDot * tanHalfFov * aspect)) * 0.5
    const screenY = 0.5 - (upDot / (forwardDot * tanHalfFov)) * 0.5
    const visible = screenX >= 0 && screenX <= 1 && screenY >= 0 && screenY <= 1
    return { x: screenX, y: screenY, visible, dist }
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    }
  }

  function update(zones, _playerPos) {
    markers = []
    if (!zones) return
    for (const z of zones) {
      const proj = projectToScreen({ x: z.x, y: 1.5, z: z.z })
      let arrowAngle = 0
      let offScreen = !proj.visible
      if (offScreen && proj.dist > 0) {
        // Calcular dirección al objetivo en screen-space (para la flecha).
        arrowAngle = Math.atan2(0.5 - proj.y, proj.x - 0.5)
      }
      markers.push({
        id: z.id,
        type: z.type,
        owner: z.owner || null,
        active: z.active !== false,
        screenX: proj.x,
        screenY: proj.y,
        dist: Math.round(proj.dist),
        visible: proj.visible,
        offScreen,
        arrowAngle,
        captureProgress: z.captureProgress || 0,
        bombPlanted: !!z.bombPlanted,
        bombTimer: z.bombTimer || 0
      })
    }
  }

  function getMarkers() {
    return markers
  }

  return { update, getMarkers, setViewport }
}

export const MARKER_COLORS = {
  flag: { neutral: 0x888888, axis: 0xb04040, allies: 0x4080c0 },
  hill: { neutral: 0xffcc40 },
  bombsite: { neutral: 0xff6020 }
}
