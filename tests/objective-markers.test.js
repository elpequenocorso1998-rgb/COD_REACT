import { describe, it, expect, beforeEach } from 'vitest'
import { createObjectiveMarkers, MARKER_COLORS } from '@/game/match/objective-markers'

function makeFakeCamera(pos = { x: 0, y: 1, z: 0 }, dir = { x: 0, y: 0, z: -1 }) {
  return {
    position: { ...pos },
    fov: 75,
    worldToLocal: () => {},
    getWorldDirection: () => ({ ...dir })
  }
}

describe('createObjectiveMarkers', () => {
  let camera, markers

  beforeEach(() => {
    camera = makeFakeCamera()
    markers = createObjectiveMarkers(camera, { w: 800, h: 600 })
  })

  it('factory expone API completa', () => {
    expect(typeof markers.update).toBe('function')
    expect(typeof markers.getMarkers).toBe('function')
    expect(typeof markers.setViewport).toBe('function')
  })

  it('update con zones vacías devuelve markers vacío', () => {
    markers.update([], { x: 0, y: 0, z: 0 })
    expect(markers.getMarkers()).toEqual([])
  })

  it('update con zones null no rompe', () => {
    expect(() => markers.update(null, null)).not.toThrow()
    expect(markers.getMarkers()).toEqual([])
  })

  it('update calcula distancia al objetivo', () => {
    const zones = [{ id: 'A', type: 'flag', x: 0, y: 0, z: -10, owner: null }]
    markers.update(zones, { x: 0, y: 1, z: 0 })
    const m = markers.getMarkers()
    expect(m.length).toBe(1)
    expect(m[0].dist).toBeGreaterThan(8)
    expect(m[0].dist).toBeLessThan(15)
  })

  it('objetivo detrás de la cámara está offScreen', () => {
    const zones = [{ id: 'B', type: 'flag', x: 0, y: 0, z: 10, owner: null }]
    markers.update(zones, { x: 0, y: 1, z: 0 })
    const m = markers.getMarkers()[0]
    expect(m.offScreen).toBe(true)
    expect(m.visible).toBe(false)
  })

  it('objetivo delante de la cámara está visible', () => {
    const zones = [{ id: 'A', type: 'flag', x: 0, y: 0, z: -10, owner: null }]
    markers.update(zones, { x: 0, y: 1, z: 0 })
    const m = markers.getMarkers()[0]
    expect(m.visible).toBe(true)
    expect(m.offScreen).toBe(false)
  })

  it('setViewport actualiza dimensiones', () => {
    expect(() => markers.setViewport(1920, 1080)).not.toThrow()
  })

  it('setViewport rechaza valores inválidos', () => {
    markers.setViewport(-1, 0)
    // No rompe; usa defaults saneados.
  })

  it('marker incluye captureProgress', () => {
    const zones = [{ id: 'A', type: 'flag', x: 0, y: 0, z: -10, captureProgress: 50 }]
    markers.update(zones, { x: 0, y: 0, z: 0 })
    expect(markers.getMarkers()[0].captureProgress).toBe(50)
  })

  it('marker de bombsite incluye bombPlanted', () => {
    const zones = [{ id: 'A', type: 'bombsite', x: 0, y: 0, z: -10, bombPlanted: true, bombTimer: 30 }]
    markers.update(zones, { x: 0, y: 0, z: 0 })
    const m = markers.getMarkers()[0]
    expect(m.bombPlanted).toBe(true)
    expect(m.bombTimer).toBe(30)
  })

  it('marker incluye owner del flag', () => {
    const zones = [{ id: 'A', type: 'flag', x: 0, y: 0, z: -10, owner: 'axis' }]
    markers.update(zones, { x: 0, y: 0, z: 0 })
    expect(markers.getMarkers()[0].owner).toBe('axis')
  })

  it('múltiples zones generan múltiples markers', () => {
    const zones = [
      { id: 'A', type: 'flag', x: -10, y: 0, z: -10 },
      { id: 'B', type: 'flag', x: 0, y: 0, z: -10 },
      { id: 'C', type: 'flag', x: 10, y: 0, z: -10 }
    ]
    markers.update(zones, { x: 0, y: 0, z: 0 })
    expect(markers.getMarkers().length).toBe(3)
  })
})

describe('MARKER_COLORS', () => {
  it('tiene colores para flag, hill, bombsite', () => {
    expect(MARKER_COLORS.flag).toBeDefined()
    expect(MARKER_COLORS.hill).toBeDefined()
    expect(MARKER_COLORS.bombsite).toBeDefined()
  })

  it('flag tiene colores neutral, axis, allies', () => {
    expect(MARKER_COLORS.flag.neutral).toBeDefined()
    expect(MARKER_COLORS.flag.axis).toBeDefined()
    expect(MARKER_COLORS.flag.allies).toBeDefined()
  })
})
