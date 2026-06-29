import { MISSIONS, getMission, getNextMission, getDifficultyConfig } from './missions.js'

/* =========================================================================
   Estado y progreso de campaña.
   --------------------------------------------------------------------------
   Persiste qué misiones están completadas, la dificultad seleccionada
   y stats por misión. Se guarda en localStorage.
   ========================================================================= */

const CAMPAIGN_KEY = 'mw_campaign_v1'

let _state = null

function loadState() {
  if (_state) return _state
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY)
    if (raw) _state = JSON.parse(raw)
  } catch (e) { _state = null }
  if (!_state) {
    _state = {
      completedMissions: [],
      currentMissionId: null,
      difficulty: 'regular',
      missionStats: {},
      totalPlaytime: 0
    }
  }
  return _state
}

function saveState() {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(_state))
  } catch (e) { /* noop */ }
}

export function getCampaignProgress() {
  return loadState()
}

export function setDifficulty(difficulty) {
  const s = loadState()
  s.difficulty = difficulty
  saveState()
}

export function getDifficulty() {
  return loadState().difficulty
}

export function getDifficultyConfigForCurrent() {
  return getDifficultyConfig(loadState().difficulty)
}

export function startMission(missionId) {
  const s = loadState()
  s.currentMissionId = missionId
  saveState()
  return getMission(missionId)
}

export function completeMission(missionId, stats = {}) {
  const s = loadState()
  if (!s.completedMissions.includes(missionId)) {
    s.completedMissions.push(missionId)
  }
  s.missionStats[missionId] = {
    completedAt: Date.now(),
    timeCompleted: stats.timeCompleted || 0,
    kills: stats.kills || 0,
    headshots: stats.headshots || 0,
    accuracy: stats.accuracy || 0,
    difficulty: s.difficulty,
    ...stats
  }
  s.currentMissionId = null
  saveState()
  return getNextMission(missionId)
}

export function isMissionCompleted(missionId) {
  return loadState().completedMissions.includes(missionId)
}

export function isMissionUnlocked(missionId) {
  const mission = getMission(missionId)
  if (!mission) return false
  if (missionId === MISSIONS[0].id) return true
  const prev = MISSIONS.find((m) => m.id === missionId - 1)
  if (!prev) return false
  return isMissionCompleted(prev.id)
}

export function getMissionStats(missionId) {
  return loadState().missionStats[missionId] || null
}

export function getCampaignCompletionPct() {
  const completed = loadState().completedMissions.length
  return Math.round((completed / MISSIONS.length) * 100)
}

export function resetCampaign() {
  _state = {
    completedMissions: [],
    currentMissionId: null,
    difficulty: 'regular',
    missionStats: {},
    totalPlaytime: 0
  }
  saveState()
}

export function getAllMissionsWithStatus() {
  return MISSIONS.map((m) => ({
    ...m,
    completed: isMissionCompleted(m.id),
    unlocked: isMissionUnlocked(m.id),
    stats: getMissionStats(m.id)
  }))
}
