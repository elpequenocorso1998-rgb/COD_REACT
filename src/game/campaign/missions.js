/* =========================================================================
   Sistema de campaña SP.
   --------------------------------------------------------------------------
   Define misiones con objetivos, mapa, aliados, enemigos, cinemáticas
   y condición de victoria. Esqueleto data-driven para que el engine
   pueda orquestar las misiones.
   ========================================================================= */

export const DIFFICULTY_LEVELS = {
  recruit: { name: 'Recruit', enemyHpMul: 0.7, enemyDamageMul: 0.5, playerHpMul: 1.5, aiAccuracy: 0.4 },
  regular: { name: 'Regular', enemyHpMul: 1.0, enemyDamageMul: 1.0, playerHpMul: 1.0, aiAccuracy: 0.6 },
  hardened: { name: 'Hardened', enemyHpMul: 1.3, enemyDamageMul: 1.3, playerHpMul: 0.85, aiAccuracy: 0.75 },
  veteran: { name: 'Veteran', enemyHpMul: 1.6, enemyDamageMul: 1.6, playerHpMul: 0.7, aiAccuracy: 0.9 }
}

export const OBJECTIVE_TYPES = {
  KILL_TARGET: 'kill_target',
  REACH_POINT: 'reach_point',
  DEFEND: 'defend',
  EXTRACT: 'extract',
  PLANT_EXPLOSIVE: 'plant_explosive',
  FOLLOW_NPC: 'follow_npc',
  SURVIVE_TIMER: 'survive_timer',
  ELIMINATE_ALL: 'eliminate_all'
}

export const MISSIONS = [
  {
    id: 1,
    name: 'Operator',
    codename: 'OPERATION FIRST LIGHT',
    brief: 'Infiltrate the desert outpost and eliminate the HVT. Exfil via northern checkpoint.',
    mapId: 'desert',
    difficulty: 'regular',
    act: 1,
    objectives: [
      { id: 'obj1', type: OBJECTIVE_TYPES.REACH_POINT, target: { x: 0, z: -20 }, radius: 5, desc: 'Reach the outpost perimeter' },
      { id: 'obj2', type: OBJECTIVE_TYPES.ELIMINATE_ALL, count: 8, desc: 'Clear the outer perimeter (0/8)' },
      { id: 'obj3', type: OBJECTIVE_TYPES.KILL_TARGET, targetId: 'hvt_1', desc: 'Eliminate the HVT' },
      { id: 'obj4', type: OBJECTIVE_TYPES.EXTRACT, target: { x: 0, z: 40 }, radius: 5, desc: 'Exfil via northern checkpoint' }
    ],
    allies: [
      { id: 'ally_1', name: 'Vasquez', position: { x: -5, z: 30 }, role: 'rifleman' },
      { id: 'ally_2', name: 'Reyes', position: { x: 5, z: 30 }, role: 'medic' }
    ],
    enemies: { count: 12, types: ['walker', 'shooter'], hvtCount: 1 },
    cinematics: [
      { id: 'intro', type: 'briefing', duration: 8 },
      { id: 'outro', type: 'extraction', duration: 5 }
    ],
    winCondition: 'all_objectives_complete'
  },
  {
    id: 2,
    name: 'Blackout',
    codename: 'OPERATION BLACKOUT',
    brief: 'Disable the enemy comms tower in the urban zone. Plant charges on the generator.',
    mapId: 'urban',
    difficulty: 'regular',
    act: 1,
    objectives: [
      { id: 'obj1', type: OBJECTIVE_TYPES.REACH_POINT, target: { x: 0, z: -30 }, radius: 5, desc: 'Reach the comms building' },
      { id: 'obj2', type: OBJECTIVE_TYPES.PLANT_EXPLOSIVE, target: { x: 0, z: -28 }, radius: 3, desc: 'Plant charges on the generator' },
      { id: 'obj3', type: OBJECTIVE_TYPES.DEFEND, target: { x: 0, z: -28 }, radius: 10, duration: 60, desc: 'Defend the charges (60s)' },
      { id: 'obj4', type: OBJECTIVE_TYPES.EXTRACT, target: { x: 30, z: 30 }, radius: 5, desc: 'Exfil to the east' }
    ],
    allies: [
      { id: 'ally_1', name: 'Vasquez', position: { x: -5, z: 25 }, role: 'rifleman' }
    ],
    enemies: { count: 18, types: ['walker', 'runner', 'shooter'] },
    cinematics: [{ id: 'intro', type: 'briefing', duration: 6 }],
    winCondition: 'all_objectives_complete'
  },
  {
    id: 3,
    name: 'Cold Front',
    codename: 'OPERATION COLD FRONT',
    brief: 'Infiltrate the arctic research base. Recover the intel and survive the counterattack.',
    mapId: 'snow',
    difficulty: 'hardened',
    act: 2,
    objectives: [
      { id: 'obj1', type: OBJECTIVE_TYPES.REACH_POINT, target: { x: -20, z: -20 }, radius: 5, desc: 'Infiltrate the base' },
      { id: 'obj2', type: OBJECTIVE_TYPES.KILL_TARGET, targetId: 'commander_1', desc: 'Eliminate the base commander' },
      { id: 'obj3', type: OBJECTIVE_TYPES.SURVIVE_TIMER, duration: 90, desc: 'Survive the counterattack (90s)' },
      { id: 'obj4', type: OBJECTIVE_TYPES.EXTRACT, target: { x: 20, z: 20 }, radius: 5, desc: 'Exfil via the east gate' }
    ],
    allies: [
      { id: 'ally_1', name: 'Vasquez', position: { x: -5, z: 25 }, role: 'rifleman' },
      { id: 'ally_2', name: 'Reyes', position: { x: 5, z: 25 }, role: 'medic' },
      { id: 'ally_3', name: 'Kamarov', position: { x: 0, z: 30 }, role: 'sniper' }
    ],
    enemies: { count: 25, types: ['walker', 'runner', 'tank', 'shooter'], hvtCount: 1 },
    cinematics: [{ id: 'intro', type: 'briefing', duration: 7 }],
    winCondition: 'all_objectives_complete'
  },
  {
    id: 4,
    name: 'Iron Works',
    codename: 'OPERATION IRON WORKS',
    brief: 'Destroy the weapons factory in the industrial sector. Race against the clock.',
    mapId: 'industrial',
    difficulty: 'hardened',
    act: 2,
    objectives: [
      { id: 'obj1', type: OBJECTIVE_TYPES.REACH_POINT, target: { x: -22, z: -22 }, radius: 6, desc: 'Reach the factory entrance' },
      { id: 'obj2', type: OBJECTIVE_TYPES.PLANT_EXPLOSIVE, target: { x: -22, z: -22 }, radius: 3, count: 3, desc: 'Plant 3 charges (0/3)' },
      { id: 'obj3', type: OBJECTIVE_TYPES.SURVIVE_TIMER, duration: 120, desc: 'Hold the factory (120s)' },
      { id: 'obj4', type: OBJECTIVE_TYPES.EXTRACT, target: { x: 22, z: 22 }, radius: 6, desc: 'Exfil before detonation' }
    ],
    allies: [
      { id: 'ally_1', name: 'Vasquez', position: { x: -5, z: 25 }, role: 'rifleman' }
    ],
    enemies: { count: 30, types: ['walker', 'runner', 'tank', 'shooter'] },
    cinematics: [{ id: 'intro', type: 'briefing', duration: 6 }],
    winCondition: 'all_objectives_complete'
  },
  {
    id: 5,
    name: 'Pamplona',
    codename: 'OPERATION SAN FERMIN',
    brief: 'Final push. Liberate the city of Pamplona. Eliminate the warlord.',
    mapId: 'pamplona',
    difficulty: 'veteran',
    act: 3,
    objectives: [
      { id: 'obj1', type: OBJECTIVE_TYPES.REACH_POINT, target: { x: 0, z: 0 }, radius: 8, desc: 'Take the plaza' },
      { id: 'obj2', type: OBJECTIVE_TYPES.ELIMINATE_ALL, count: 20, desc: 'Clear the plaza (0/20)' },
      { id: 'obj3', type: OBJECTIVE_TYPES.KILL_TARGET, targetId: 'warlord_1', desc: 'Eliminate the warlord' },
      { id: 'obj4', type: OBJECTIVE_TYPES.EXTRACT, target: { x: 0, z: 40 }, radius: 5, desc: 'Link up with friendly forces' }
    ],
    allies: [
      { id: 'ally_1', name: 'Vasquez', position: { x: -10, z: 30 }, role: 'rifleman' },
      { id: 'ally_2', name: 'Reyes', position: { x: 10, z: 30 }, role: 'medic' },
      { id: 'ally_3', name: 'Kamarov', position: { x: 0, z: 35 }, role: 'sniper' },
      { id: 'ally_4', name: 'Nikolai', position: { x: -5, z: 35 }, role: 'heavy' }
    ],
    enemies: { count: 40, types: ['walker', 'runner', 'tank', 'shooter'], hvtCount: 1 },
    cinematics: [
      { id: 'intro', type: 'briefing', duration: 10 },
      { id: 'outro', type: 'victory', duration: 8 }
    ],
    winCondition: 'all_objectives_complete'
  }
]

export function getMission(missionId) {
  return MISSIONS.find((m) => m.id === missionId) || null
}

export function getMissionsByAct(act) {
  return MISSIONS.filter((m) => m.act === act)
}

export function getFirstMission() {
  return MISSIONS[0]
}

export function getNextMission(currentMissionId) {
  const idx = MISSIONS.findIndex((m) => m.id === currentMissionId)
  if (idx === -1 || idx >= MISSIONS.length - 1) return null
  return MISSIONS[idx + 1]
}

export function getDifficultyConfig(difficulty) {
  return DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS.regular
}

export function getTotalMissions() {
  return MISSIONS.length
}
