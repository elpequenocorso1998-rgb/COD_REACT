import { describe, it, expect, beforeEach } from 'vitest'
import {
  getFriends, addFriend, removeFriend,
  createParty, joinParty, leaveParty, sendPartyInvite,
  getParty, setMemberReady, allMembersReady, resetSocial
} from '../src/game/backend/local-social.js'

describe('local-social — friends', () => {
  beforeEach(() => {
    resetSocial()
  })

  it('getFriends devuelve array vacío inicial', () => {
    expect(getFriends()).toEqual([])
  })

  it('addFriend añade amigo', () => {
    expect(addFriend(1, 'Alice')).toBe(true)
    const friends = getFriends()
    expect(friends.length).toBe(1)
    expect(friends[0].name).toBe('Alice')
  })

  it('addFriend no duplica', () => {
    addFriend(1, 'Alice')
    expect(addFriend(1, 'Alice')).toBe(false)
    expect(getFriends().length).toBe(1)
  })

  it('removeFriend elimina amigo', () => {
    addFriend(1, 'Alice')
    addFriend(2, 'Bob')
    expect(removeFriend(1)).toBe(true)
    expect(getFriends().length).toBe(1)
    expect(getFriends()[0].id).toBe(2)
  })

  it('removeFriend devuelve false si no existe', () => {
    expect(removeFriend(99)).toBe(false)
  })
})

describe('local-social — party', () => {
  beforeEach(() => {
    resetSocial()
  })

  it('createParty crea party con código y 1 miembro', () => {
    const party = createParty(1, 'Alice')
    expect(party).not.toBeNull()
    expect(party.code).toBeTruthy()
    expect(party.code.length).toBe(6)
    expect(party.leaderId).toBe(1)
    expect(party.members.length).toBe(1)
    expect(party.members[0].ready).toBe(true)
  })

  it('getParty devuelve null si no hay party', () => {
    expect(getParty()).toBeNull()
  })

  it('joinParty con código existente añade miembro', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    const party = joinParty(code, 2, 'Bob')
    expect(party.members.length).toBe(2)
    expect(party.members[1].name).toBe('Bob')
    expect(party.members[1].ready).toBe(false)
  })

  it('joinParty con código nuevo crea party virtual', () => {
    const party = joinParty('XYZ123', 1, 'Alice')
    expect(party).not.toBeNull()
    expect(party.code).toBe('XYZ123')
    expect(party.members.length).toBe(1)
  })

  it('leaveParty elimina miembro', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    joinParty(code, 2, 'Bob')
    expect(getParty().members.length).toBe(2)
    leaveParty(2)
    expect(getParty().members.length).toBe(1)
  })

  it('leaveParty con 0 miembros elimina party', () => {
    createParty(1, 'Alice')
    leaveParty(1)
    expect(getParty()).toBeNull()
  })

  it('leaveParty transfiere liderazgo si leader se va', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    joinParty(code, 2, 'Bob')
    leaveParty(1)
    expect(getParty().leaderId).toBe(2)
  })

  it('sendPartyInvite devuelve código', () => {
    createParty(1, 'Alice')
    const invite = sendPartyInvite(2, 'Bob')
    expect(invite).not.toBeNull()
    expect(invite.partyCode).toBeTruthy()
    expect(invite.invitedUserId).toBe(2)
  })

  it('sendPartyInvite sin party devuelve null', () => {
    expect(sendPartyInvite(2, 'Bob')).toBeNull()
  })

  it('setMemberReady actualiza ready flag', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    joinParty(code, 2, 'Bob')
    expect(setMemberReady(2, true)).toBe(true)
    const m = getParty().members.find((m) => m.id === 2)
    expect(m.ready).toBe(true)
  })

  it('setMemberReady devuelve false si no existe', () => {
    createParty(1, 'Alice')
    expect(setMemberReady(99, true)).toBe(false)
  })

  it('allMembersReady true cuando todos ready', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    joinParty(code, 2, 'Bob')
    setMemberReady(2, true)
    expect(allMembersReady()).toBe(true)
  })

  it('allMembersReady false si alguno no ready', () => {
    createParty(1, 'Alice')
    const code = getParty().code
    joinParty(code, 2, 'Bob')
    expect(allMembersReady()).toBe(false)
  })

  it('allMembersReady false si no hay party', () => {
    expect(allMembersReady()).toBe(false)
  })

  it('resetSocial limpia friends y party', () => {
    addFriend(1, 'Alice')
    createParty(1, 'Alice')
    resetSocial()
    expect(getFriends()).toEqual([])
    expect(getParty()).toBeNull()
  })
})
