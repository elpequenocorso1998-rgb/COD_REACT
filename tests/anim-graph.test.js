import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import { createAnimGraph, STANCES } from '@/game/anim/graph'

function makeMesh() {
  return new THREE.Object3D()
}

function makeClip(name, duration = 1) {
  return new THREE.AnimationClip(name, duration, [])
}

describe('STANCES', () => {
  it('contiene stand, crouch, prone, slide, sprint', () => {
    expect(STANCES.has('stand')).toBe(true)
    expect(STANCES.has('crouch')).toBe(true)
    expect(STANCES.has('prone')).toBe(true)
    expect(STANCES.has('slide')).toBe(true)
    expect(STANCES.has('sprint')).toBe(true)
  })
})

describe('createAnimGraph', () => {
  let mesh
  let clips

  beforeEach(() => {
    mesh = makeMesh()
    clips = [
      makeClip('idle', 1),
      makeClip('walk', 1),
      makeClip('run', 0.8),
      makeClip('reload', 2.0),
      makeClip('fire', 0.3),
      makeClip('dead', 1.5)
    ]
  })

  it('factory devuelve API completa', () => {
    const graph = createAnimGraph(mesh, clips)
    expect(typeof graph.addState).toBe('function')
    expect(typeof graph.addTransition).toBe('function')
    expect(typeof graph.setParam).toBe('function')
    expect(typeof graph.getParam).toBe('function')
    expect(typeof graph.trigger).toBe('function')
    expect(typeof graph.update).toBe('function')
    expect(typeof graph.evaluate).toBe('function')
    expect(typeof graph.blendWalk).toBe('function')
    expect(typeof graph.dispose).toBe('function')
    graph.dispose()
  })

  it('addState con clip inexistente no crashea', () => {
    const graph = createAnimGraph(mesh, clips)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    graph.addState('idle', 'nonexistent_clip')
    expect(warn).toHaveBeenCalled()
    graph.dispose()
  })

  it('addState primer estado se hace current', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    expect(graph.currentState).toBe('idle')
    graph.dispose()
  })

  it('setParam / getParam', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.setParam('speed', 5.5)
    expect(graph.getParam('speed')).toBe(5.5)
    graph.dispose()
  })

  it('trigger cambia a estado existente', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    graph.addState('reload', 'reload')
    graph.trigger('reload', 0.1)
    graph.update(0.2)
    expect(graph.currentState).toBe('reload')
    graph.dispose()
  })

  it('trigger a estado inexistente no crashea', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    expect(() => graph.trigger('nonexistent', 0.1)).not.toThrow()
    graph.dispose()
  })

  it('trigger al mismo estado resetea la action', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    expect(() => graph.trigger('idle')).not.toThrow()
    graph.dispose()
  })

  it('addTransition ejecuta condition y cambia de estado', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    graph.addState('dead', 'dead')
    graph.addTransition('idle', 'dead', (p) => p.healthPct <= 0, 0.2)
    graph.setParam('healthPct', 0)
    graph.evaluate()
    graph.update(0.3)
    expect(graph.currentState).toBe('dead')
    graph.dispose()
  })

  it('addTransition que no se cumple no cambia de estado', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    graph.addState('dead', 'dead')
    graph.addTransition('idle', 'dead', (p) => p.healthPct <= 0, 0.2)
    graph.setParam('healthPct', 0.5)
    graph.evaluate()
    expect(graph.currentState).toBe('idle')
    graph.dispose()
  })

  it('update sin estados no crashea', () => {
    const graph = createAnimGraph(mesh, clips)
    expect(() => graph.update(0.016)).not.toThrow()
    graph.dispose()
  })

  it('blendWalk no crashea sin clips idle/walk/run', () => {
    const graph = createAnimGraph(mesh, [makeClip('idle', 1)])
    graph.addState('idle', 'idle')
    expect(() => graph.blendWalk()).not.toThrow()
    graph.dispose()
  })

  it('params iniciales con defaults correctos', () => {
    const graph = createAnimGraph(mesh, clips)
    expect(graph.params.speed).toBe(0)
    expect(graph.params.isAiming).toBe(false)
    expect(graph.params.isReloading).toBe(false)
    expect(graph.params.healthPct).toBe(1)
    expect(graph.params.stance).toBe('stand')
    expect(graph.params.inAir).toBe(false)
    graph.dispose()
  })

  it('mixer expuesto', () => {
    const graph = createAnimGraph(mesh, clips)
    expect(graph.mixer).toBeInstanceOf(THREE.AnimationMixer)
    graph.dispose()
  })

  it('dispose libera recursos sin crashear', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    graph.addState('walk', 'walk')
    graph.trigger('walk')
    graph.update(0.016)
    expect(() => graph.dispose()).not.toThrow()
  })

  it('transición completa respeta duration', () => {
    const graph = createAnimGraph(mesh, clips)
    graph.addState('idle', 'idle')
    graph.addState('reload', 'reload')
    graph.trigger('reload', 0.3)
    graph.update(0.1)
    expect(graph.currentState).toBe('idle')
    graph.update(0.25)
    expect(graph.currentState).toBe('reload')
    graph.dispose()
  })
})
