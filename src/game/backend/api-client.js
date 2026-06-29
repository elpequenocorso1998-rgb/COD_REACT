/* =========================================================================
   Backend API client + DB schema + account system.
   --------------------------------------------------------------------------
   Esqueleto de cliente API para el backend de cuentas/inventario/partidas.
   Diseñado para conectar con un backend REST/GraphQL real (Fase 12).
   Incluye:
   - Auth (email + OAuth Google/Steam/Discord/Apple/Sony).
   - Inventario sincronizado (reemplaza localStorage de progression.js).
   - Matchmaking API.
   - Friends/party.
   - Voice chat signaling.
   - Telemetry/analytics.
   - Reports & moderation.

   DB schema (Postgres) documentado para implementación server-side.
   ========================================================================= */

import { getProgress } from '../progression.js'

const API_BASE = import.meta.env?.VITE_API_URL || '/api'
const TOKEN_KEY = 'mw_token_v1'

let _token = null
let _user = null

function getToken() {
  if (_token) return _token
  try {
    _token = localStorage.getItem(TOKEN_KEY)
  } catch (e) { _token = null }
  return _token
}

function setToken(token) {
  _token = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (e) { /* noop */ }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth && getToken()) {
    headers.Authorization = `Bearer ${getToken()}`
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return await res.json()
  } catch (e) {
    console.warn(`[api] ${method} ${path} failed:`, e.message)
    throw e
  }
}

export const OAuth_PROVIDERS = {
  GOOGLE: 'google',
  STEAM: 'steam',
  DISCORD: 'discord',
  APPLE: 'apple',
  SONY: 'sony',
  MICROSOFT: 'microsoft'
}

export function createApiClient() {
  async function registerWithEmail(email, password, displayName) {
    const result = await request('/auth/register', {
      method: 'POST',
      auth: false,
      body: { email, password, displayName }
    })
    setToken(result.token)
    _user = result.user
    return result
  }

  async function loginWithEmail(email, password) {
    const result = await request('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password }
    })
    setToken(result.token)
    _user = result.user
    return result
  }

  async function loginWithOAuth(provider, oauthToken) {
    const result = await request('/auth/oauth', {
      method: 'POST',
      auth: false,
      body: { provider, token: oauthToken }
    })
    setToken(result.token)
    _user = result.user
    return result
  }

  async function logout() {
    try {
      await request('/auth/logout', { method: 'POST' })
    } catch (e) { /* noop */ }
    setToken(null)
    _user = null
  }

  function isAuthenticated() {
    return !!getToken()
  }

  function getCurrentUser() {
    return _user
  }

  async function getProfile() {
    const result = await request('/profile')
    _user = result
    return result
  }

  async function syncInventory() {
    const localProgress = getProgress()
    const result = await request('/inventory/sync', {
      method: 'POST',
      body: { local: localProgress }
    })
    return result
  }

  async function getInventory() {
    return await request('/inventory')
  }

  async function unlockItem(itemId, type) {
    return await request('/inventory/unlock', {
      method: 'POST',
      body: { itemId, type }
    })
  }

  async function equipItem(itemId, slot, weaponId = null) {
    return await request('/inventory/equip', {
      method: 'POST',
      body: { itemId, slot, weaponId }
    })
  }

  async function findMatch({ mode, inputType, partyId = null, region = 'auto' }) {
    return await request('/matchmaking/find', {
      method: 'POST',
      body: { mode, inputType, partyId, region }
    })
  }

  async function cancelMatchmaking(ticketId) {
    return await request(`/matchmaking/cancel/${ticketId}`, { method: 'POST' })
  }

  async function getMatchmakingStatus(ticketId) {
    return await request(`/matchmaking/status/${ticketId}`)
  }

  async function getFriends() {
    return await request('/friends')
  }

  async function addFriend(userId) {
    return await request('/friends/add', {
      method: 'POST',
      body: { userId }
    })
  }

  async function removeFriend(userId) {
    return await request(`/friends/${userId}`, { method: 'DELETE' })
  }

  async function createParty() {
    return await request('/party/create', { method: 'POST' })
  }

  async function joinParty(partyCode) {
    return await request('/party/join', {
      method: 'POST',
      body: { partyCode }
    })
  }

  async function leaveParty(partyId) {
    return await request(`/party/${partyId}/leave`, { method: 'POST' })
  }

  async function sendPartyInvite(userId) {
    return await request('/party/invite', {
      method: 'POST',
      body: { userId }
    })
  }

  async function getVoiceToken(channelId) {
    return await request(`/voice/token/${channelId}`)
  }

  async function reportPlayer(userId, reason, description = '') {
    return await request('/reports', {
      method: 'POST',
      body: { reportedUserId: userId, reason, description }
    })
  }

  async function submitMatchResult(matchId, result) {
    return await request('/matches/result', {
      method: 'POST',
      body: { matchId, result }
    })
  }

  async function getMatchHistory(limit = 20) {
    return await request(`/matches/history?limit=${limit}`)
  }

  async function getLeaderboard(mode = 'tdm', period = 'season') {
    return await request(`/leaderboard?mode=${mode}&period=${period}`)
  }

  async function trackEvent(eventName, properties = {}) {
    if (!isAuthenticated()) return
    try {
      await request('/telemetry', {
        method: 'POST',
        body: { event: eventName, properties, timestamp: Date.now() }
      })
    } catch (e) { /* noop */ }
  }

  return {
    registerWithEmail,
    loginWithEmail,
    loginWithOAuth,
    logout,
    isAuthenticated,
    getCurrentUser,
    getProfile,
    syncInventory,
    getInventory,
    unlockItem,
    equipItem,
    findMatch,
    cancelMatchmaking,
    getMatchmakingStatus,
    getFriends,
    addFriend,
    removeFriend,
    createParty,
    joinParty,
    leaveParty,
    sendPartyInvite,
    getVoiceToken,
    reportPlayer,
    submitMatchResult,
    getMatchHistory,
    getLeaderboard,
    trackEvent
  }
}

export const DB_SCHEMA = `
-- Postgres schema para Modern Warfare backend.

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(32) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  banned BOOLEAN DEFAULT FALSE,
  ban_reason VARCHAR(100),
  ban_expires TIMESTAMPTZ,
  hwid VARCHAR(64),
  region VARCHAR(10)
);

CREATE TABLE oauth_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  provider_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE progression (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp BIGINT DEFAULT 0,
  level INT DEFAULT 1,
  total_kills INT DEFAULT 0,
  total_deaths INT DEFAULT 0,
  highest_wave INT DEFAULT 0,
  playtime_seconds INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL,  -- weapon, attachment, perk, cosmetic, calling_card
  item_id VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  source VARCHAR(20) DEFAULT 'level',  -- level, store, battle_pass, challenge
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE weapon_progression (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  weapon_id VARCHAR(50) NOT NULL,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  camos JSONB DEFAULT '[]',
  kills INT DEFAULT 0,
  headshots INT DEFAULT 0,
  UNIQUE(user_id, weapon_id)
);

CREATE TABLE loadouts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  slot INT NOT NULL DEFAULT 0,
  name VARCHAR(32),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slot)
);

CREATE TABLE matches (
  id BIGSERIAL PRIMARY KEY,
  mode VARCHAR(30) NOT NULL,
  map_id VARCHAR(30) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  score_axis INT DEFAULT 0,
  score_allies INT DEFAULT 0,
  winner VARCHAR(10),
  server_region VARCHAR(10)
);

CREATE TABLE match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id BIGINT REFERENCES matches(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id),
  team VARCHAR(10),
  kills INT DEFAULT 0,
  deaths INT DEFAULT 0,
  assists INT DEFAULT 0,
  score INT DEFAULT 0,
  xp_earned INT DEFAULT 0,
  weapon VARCHAR(50),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

CREATE TABLE ranked (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sr INT DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze',
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  mvp_count INT DEFAULT 0,
  placements_complete BOOLEAN DEFAULT FALSE,
  placement_matches INT DEFAULT 0,
  last_match_at TIMESTAMPTZ,
  season_id INT DEFAULT 1
);

CREATE TABLE seasons (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  battle_pass_tiers INT DEFAULT 100,
  is_active BOOLEAN DEFAULT FALSE
);

CREATE TABLE battle_pass (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  season_id INT REFERENCES seasons(id),
  tier INT DEFAULT 0,
  xp INT DEFAULT 0,
  premium BOOLEAN DEFAULT FALSE,
  claimed_tiers JSONB DEFAULT '[]',
  UNIQUE(user_id, season_id)
);

CREATE TABLE friends (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  friend_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, blocked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE parties (
  id BIGSERIAL PRIMARY KEY,
  leader_id BIGINT REFERENCES users(id),
  code VARCHAR(8) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  max_size INT DEFAULT 6
);

CREATE TABLE party_members (
  party_id BIGINT REFERENCES parties(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  ready BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (party_id, user_id)
);

CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id BIGINT REFERENCES users(id),
  reported_id BIGINT REFERENCES users(id),
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  match_id BIGINT REFERENCES matches(id),
  status VARCHAR(20) DEFAULT 'open',  -- open, reviewed, resolved, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(100)
);

CREATE TABLE bans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  reason VARCHAR(50) NOT NULL,
  banned_by BIGINT REFERENCES users(id),
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT FALSE,
  hwid VARCHAR(64)
);

CREATE TABLE telemetry (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  event VARCHAR(100) NOT NULL,
  properties JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_started ON matches(started_at DESC);
CREATE INDEX idx_match_players_user ON match_players(user_id);
CREATE INDEX idx_ranked_season ON ranked(season_id, sr DESC);
CREATE INDEX idx_friends_user ON friends(user_id, status);
CREATE INDEX idx_telemetry_event ON telemetry(event, timestamp);
CREATE INDEX idx_reports_status ON reports(status, created_at);
`
