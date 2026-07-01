/* =========================================================================
   Local social/party mock (Fase 18.51).
   --------------------------------------------------------------------------
   Mock local (localStorage) de friends, party e invites para jugar sin
   backend. Sirve de fallback cuando no hay servidor de cuentas.

   API equivalente a api-client.js (subset social):
   - getFriends(): lista de amigos.
   - addFriend(userId, name): añade amigo.
   - removeFriend(userId): elimina amigo.
   - createParty(): crea party con código alfanumérico.
   - joinParty(partyCode): une a party existente.
   - leaveParty(): sale de la party actual.
   - sendPartyInvite(userId): genera invite (mock: añade a party local).
   - getParty(): devuelve party actual { id, code, members[] }.
   ========================================================================= */

const STORAGE_KEY = 'mw_social_v1'

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) { /* ignore */ }
  return {
    friends: [],
    party: null
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) { /* ignore */ }
}

function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

export function getFriends() {
  return loadState().friends
}

export function addFriend(userId, name = `Player${userId}`) {
  const s = loadState()
  if (s.friends.find((f) => f.id === userId)) return false
  s.friends.push({ id: userId, name, addedAt: Date.now() })
  saveState(s)
  return true
}

export function removeFriend(userId) {
  const s = loadState()
  const before = s.friends.length
  s.friends = s.friends.filter((f) => f.id !== userId)
  saveState(s)
  return s.friends.length < before
}

export function createParty(creatorId, creatorName = `Player${creatorId}`) {
  const s = loadState()
  const party = {
    id: `party_${Date.now()}`,
    code: genCode(),
    leaderId: creatorId,
    members: [{ id: creatorId, name: creatorName, ready: true }],
    createdAt: Date.now()
  }
  s.party = party
  saveState(s)
  return party
}

export function joinParty(partyCode, userId, name = `Player${userId}`) {
  const s = loadState()
  if (!s.party || s.party.code !== partyCode) {
    // En mock local, aceptamos cualquier código: creamos party virtual.
    s.party = {
      id: `party_${Date.now()}`,
      code: partyCode,
      leaderId: null,
      members: [{ id: userId, name, ready: false }],
      createdAt: Date.now()
    }
  } else if (!s.party.members.find((m) => m.id === userId)) {
    s.party.members.push({ id: userId, name, ready: false })
  }
  saveState(s)
  return s.party
}

export function leaveParty(userId) {
  const s = loadState()
  if (!s.party) return false
  s.party.members = s.party.members.filter((m) => m.id !== userId)
  if (s.party.members.length === 0) {
    s.party = null
  } else if (s.party.leaderId === userId) {
    s.party.leaderId = s.party.members[0].id
  }
  saveState(s)
  return true
}

export function sendPartyInvite(userId, name = `Player${userId}`) {
  const s = loadState()
  if (!s.party) return null
  // Mock: el invite es un código que el otro "acepta" via joinParty.
  return { partyCode: s.party.code, invitedUserId: userId, invitedName: name }
}

export function getParty() {
  return loadState().party
}

export function setMemberReady(userId, ready) {
  const s = loadState()
  if (!s.party) return false
  const m = s.party.members.find((m) => m.id === userId)
  if (!m) return false
  m.ready = ready
  saveState(s)
  return true
}

export function allMembersReady() {
  const s = loadState()
  if (!s.party || s.party.members.length === 0) return false
  return s.party.members.every((m) => m.ready)
}

export function resetSocial() {
  saveState({ friends: [], party: null })
}
