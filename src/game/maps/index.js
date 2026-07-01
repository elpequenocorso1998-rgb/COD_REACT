import { buildDesert } from './desert.js'
import { buildUrban } from './urban.js'
import { buildSnow } from './snow.js'
import { buildIndustrial } from './industrial.js'
import { buildFiringRange, FIRING_RANGE_META } from './firing-range.js'

/* =========================================================================
   Registro de mapas.
   --------------------------------------------------------------------------
   Cada entrada declara metadata (id, name, biome, lighting, fog) y el
   builder que construye el contenido del mapa en la escena.
   'pamplona' se sigue construyendo directamente en world.js (legacy).
   ========================================================================= */

export const MAPS = {
  pamplona: {
    id: 'pamplona',
    name: 'Pamplona',
    biome: 'mediterranean',
    desc: 'Plaza del Castillo, plaza de toros, murallas, casas de sillar',
    fogColor: 0xd9b888,
    fogDensity: 0.012,
    sunColor: 0xffd9a8,
    sunIntensity: 1.2,
    ambientColor: 0x6a5a4a,
    ambientIntensity: 0.5,
    hemiSky: 0xffd9a8,
    hemiGround: 0x3a2a1a,
    hemiIntensity: 0.7,
    skyTop: 0x4a6a9a,
    skyBottom: 0xffd9a8,
    builder: null
  },
  desert: {
    id: 'desert',
    name: 'Desert Outpost',
    biome: 'desert',
    desc: 'Outpost militar en el desierto con hangares y torres',
    fogColor: 0xc2a878,
    fogDensity: 0.008,
    sunColor: 0xffeaa8,
    sunIntensity: 1.5,
    ambientColor: 0x8a7a5a,
    ambientIntensity: 0.6,
    hemiSky: 0xffeaa8,
    hemiGround: 0x6a5a3a,
    hemiIntensity: 0.8,
    skyTop: 0x8ab4d8,
    skyBottom: 0xffeaa8,
    builder: buildDesert
  },
  urban: {
    id: 'urban',
    name: 'Urban Destroyed',
    biome: 'urban',
    desc: 'Ciudad moderna destruida con edificios y coches abandonados',
    fogColor: 0x6a6a6a,
    fogDensity: 0.015,
    sunColor: 0xb8b8b8,
    sunIntensity: 0.9,
    ambientColor: 0x4a4a4a,
    ambientIntensity: 0.6,
    hemiSky: 0x8a8a8a,
    hemiGround: 0x2a2a2a,
    hemiIntensity: 0.6,
    skyTop: 0x5a6a7a,
    skyBottom: 0x8a8a8a,
    builder: buildUrban
  },
  snow: {
    id: 'snow',
    name: 'Snow Base',
    biome: 'arctic',
    desc: 'Base militar ártica con hangares, torres de radio y nieve',
    fogColor: 0xc8d4e0,
    fogDensity: 0.018,
    sunColor: 0xe8f0f8,
    sunIntensity: 1.0,
    ambientColor: 0x6a7a8a,
    ambientIntensity: 0.7,
    hemiSky: 0xc8d4e0,
    hemiGround: 0xa8b4c0,
    hemiIntensity: 0.9,
    skyTop: 0x6a8aa8,
    skyBottom: 0xc8d4e0,
    builder: buildSnow
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial Complex',
    biome: 'industrial',
    desc: 'Fábrica con tanques, tuberías, grúas y contenedores',
    fogColor: 0x5a5a5a,
    fogDensity: 0.014,
    sunColor: 0xa8a8a8,
    sunIntensity: 1.0,
    ambientColor: 0x3a3a3a,
    ambientIntensity: 0.5,
    hemiSky: 0x6a6a6a,
    hemiGround: 0x2a2a2a,
    hemiIntensity: 0.6,
    skyTop: 0x4a5a6a,
    skyBottom: 0x7a7a7a,
    builder: buildIndustrial
  },
  firingRange: {
    ...FIRING_RANGE_META,
    builder: buildFiringRange
  }
}

export const MAP_IDS = Object.keys(MAPS)

export function getMapConfig(mapId) {
  return MAPS[mapId] || MAPS.pamplona
}

export function getDefaultMapId() {
  return 'pamplona'
}
