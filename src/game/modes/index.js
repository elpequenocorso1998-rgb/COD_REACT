/* =========================================================================
   Modos de juego.
   --------------------------------------------------------------------------
   Define las reglas de cada modo: score limits, respawns, teams, objectives.
   Esqueleto data-driven para que engine.js y server.js puedan orquestar.
   ========================================================================= */

export const GAME_MODES = {
  survival: {
    id: 'survival',
    name: 'Survival',
    desc: 'Survive endless waves of enemies',
    type: 'pve',
    teams: 0,
    maxPlayers: 1,
    scoreLimit: 0,
    respawn: false,
    respawnDelay: 0,
    winCondition: 'none',
    rounds: false
  },
  campaign: {
    id: 'campaign',
    name: 'Campaign',
    desc: 'Story missions with objectives',
    type: 'pve',
    teams: 0,
    maxPlayers: 1,
    scoreLimit: 0,
    respawn: false,
    respawnDelay: 0,
    winCondition: 'objectives',
    rounds: false
  },
  tdm: {
    id: 'tdm',
    name: 'Team Deathmatch',
    desc: 'Two teams fight to reach the score limit',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 75,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false
  },
  ffa: {
    id: 'ffa',
    name: 'Free For All',
    desc: 'Everyone for themselves. First to 30 kills wins.',
    type: 'pvp',
    teams: 0,
    maxPlayers: 8,
    scoreLimit: 30,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false
  },
  domination: {
    id: 'domination',
    name: 'Domination',
    desc: 'Capture and hold 3 zones (A, B, C). First to 200 points.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 200,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false,
    objectives: ['A', 'B', 'C']
  },
  hardpoint: {
    id: 'hardpoint',
    name: 'Hardpoint',
    desc: 'Capture and hold the rotating hardpoint. First to 250 points.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 250,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false,
    objectiveRotates: true,
    objectiveRotationTime: 60
  },
  killConfirmed: {
    id: 'killConfirmed',
    name: 'Kill Confirmed',
    desc: 'Collect dog tags from fallen enemies. First to 65 confirms.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 65,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false
  },
  searchDestroy: {
    id: 'searchDestroy',
    name: 'Search & Destroy',
    desc: 'Plant the bomb or eliminate the enemy team. No respawn. Best of 11.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 6,
    respawn: false,
    respawnDelay: 0,
    winCondition: 'rounds',
    rounds: true,
    bestOf: 11
  },
  gunfight: {
    id: 'gunfight',
    name: 'Gunfight',
    desc: '2v2. Weapon rotation each round. First to 6 rounds wins.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 4,
    scoreLimit: 6,
    respawn: false,
    respawnDelay: 0,
    winCondition: 'rounds',
    rounds: true,
    roundTime: 40,
    overtimeCapture: true
  },
  gunGame: {
    id: 'gunGame',
    name: 'Gun Game',
    desc: 'Get a kill with every weapon. First through all 18 wins.',
    type: 'pvp',
    teams: 0,
    maxPlayers: 8,
    scoreLimit: 18,
    respawn: true,
    respawnDelay: 2,
    winCondition: 'score_limit',
    rounds: false,
    weaponProgression: true
  },
  infected: {
    id: 'infected',
    name: 'Infected',
    desc: 'Survivors vs Infected. When killed, you join the Infected.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 0,
    respawn: true,
    respawnDelay: 2,
    winCondition: 'last_survivor',
    rounds: false,
    asymmetrical: true
  },
  groundWar: {
    id: 'groundWar',
    name: 'Ground War',
    desc: '32v32 large-scale battle with vehicles. First to 150 points.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 64,
    scoreLimit: 150,
    respawn: true,
    respawnDelay: 5,
    winCondition: 'score_limit',
    rounds: false,
    vehicles: true
  },
  warzone: {
    id: 'warzone',
    name: 'Warzone',
    desc: 'Battle Royale. Last squad standing wins.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 100,
    scoreLimit: 1,
    respawn: false,
    respawnDelay: 0,
    winCondition: 'last_squad',
    rounds: false,
    hasGulag: true,
    contraction: true
  },
  hardcore: {
    id: 'hardcore',
    name: 'Hardcore TDM',
    desc: 'No HUD. 30 HP. Friendly fire on. One-shot kills.',
    type: 'pvp',
    teams: 2,
    maxPlayers: 12,
    scoreLimit: 75,
    respawn: true,
    respawnDelay: 3,
    winCondition: 'score_limit',
    rounds: false,
    playerHP: 30,
    noHUD: true,
    friendlyFire: true
  }
}

export const PVP_MODES = Object.values(GAME_MODES)
  .filter((m) => m.type === 'pvp')
  .map((m) => m.id)

export const PVE_MODES = Object.values(GAME_MODES)
  .filter((m) => m.type === 'pve')
  .map((m) => m.id)

export function getGameMode(modeId) {
  return GAME_MODES[modeId] || null
}

export function getDefaultPvPMode() {
  return 'tdm'
}

export function getDefaultPvEMode() {
  return 'survival'
}

export function isPvP(modeId) {
  const m = getGameMode(modeId)
  return m ? m.type === 'pvp' : false
}

export function isPvE(modeId) {
  const m = getGameMode(modeId)
  return m ? m.type === 'pve' : false
}

export function getTeamCount(modeId) {
  const m = getGameMode(modeId)
  return m ? m.teams : 0
}

export function getMaxPlayers(modeId) {
  const m = getGameMode(modeId)
  return m ? m.maxPlayers : 1
}
