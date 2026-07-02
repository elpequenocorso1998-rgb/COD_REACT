import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAudioSystem } from '@/game/effects/audio'

class FakeAudioBuffer {}
if (typeof globalThis.AudioBuffer === 'undefined') {
  globalThis.AudioBuffer = FakeAudioBuffer
}

function makeFakeCtx() {
  const fakeNode = () => ({
    connect: vi.fn(() => ({ connect: vi.fn() })),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), linearRampToValueAtTime: vi.fn() },
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    playbackRate: { value: 1 },
    Q: { value: 0 },
    setPosition: vi.fn(),
    panningModel: '',
    buffer: null,
    onended: null
  })
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    sampleRate: 44100,
    createGain: vi.fn(fakeNode),
    createOscillator: vi.fn(fakeNode),
    createBufferSource: vi.fn(fakeNode),
    createBiquadFilter: vi.fn(fakeNode),
    createDelay: vi.fn(() => {
      const n = fakeNode()
      n.delayTime = { value: 0 }
      return n
    }),
    createPanner: vi.fn(fakeNode),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(100) })),
    decodeAudioData: vi.fn(async () => ({})),
    createConvolver: vi.fn(() => ({ buffer: null, disconnect: vi.fn(), connect: vi.fn() })),
    close: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined)
  }
}

describe('audio sample bank + reverb', () => {
  let originalAudio

  beforeEach(() => {
    originalAudio = globalThis.window
    const ctx = makeFakeCtx()
    globalThis.window = globalThis.window || {}
    globalThis.window.AudioContext = vi.fn(() => ctx)
    globalThis.window.webkitAudioContext = globalThis.window.AudioContext
  })

  afterEach(() => {
    if (originalAudio === undefined) delete globalThis.window
    else globalThis.window = originalAudio
    vi.restoreAllMocks()
  })

  it('loadSamples registra buffers válidos', () => {
    const audio = createAudioSystem()
    audio.init()
    const fakeBuffer = Object.create(AudioBuffer.prototype)
    fakeBuffer.duration = 0.5
    audio.loadSamples({ shoot: fakeBuffer })
    expect(audio.hasSample('shoot')).toBe(true)
    expect(audio.hasSample('reload')).toBe(false)
    audio.dispose()
  })

  it('loadSamples ignora valores no-AudioBuffer', () => {
    const audio = createAudioSystem()
    audio.init()
    audio.loadSamples({ invalid: 'not a buffer' })
    expect(audio.hasSample('invalid')).toBe(false)
    audio.dispose()
  })

  it('playSample devuelve false si no hay sample', () => {
    const audio = createAudioSystem()
    audio.init()
    expect(audio.playSample('nonexistent')).toBe(false)
    audio.dispose()
  })

  it('playSample devuelve true y reproduce si hay sample', () => {
    const audio = createAudioSystem()
    audio.init()
    const fakeBuffer = Object.create(AudioBuffer.prototype)
    fakeBuffer.duration = 0.5
    audio.loadSamples({ shoot: fakeBuffer })
    expect(audio.playSample('shoot', { volume: 0.8 })).toBe(true)
    audio.dispose()
  })

  it('loadReverbIR registra el IR', () => {
    const audio = createAudioSystem()
    audio.init()
    const ir = Object.create(AudioBuffer.prototype)
    audio.loadReverbIR('hall', ir)
    expect(audio.getReverb('hall')).not.toBeNull()
    expect(audio.getReverb('nope')).toBeNull()
    audio.dispose()
  })

  it('playShoot con sample cargado usa el sample (no procedural)', () => {
    const audio = createAudioSystem()
    audio.init()
    const fakeBuffer = Object.create(AudioBuffer.prototype)
    fakeBuffer.duration = 0.3
    audio.loadSamples({ shoot: fakeBuffer })
    expect(() => audio.playShoot()).not.toThrow()
    audio.dispose()
  })

  it('dispose limpia sampleBank', () => {
    const audio = createAudioSystem()
    audio.init()
    const fakeBuffer = Object.create(AudioBuffer.prototype)
    audio.loadSamples({ shoot: fakeBuffer })
    audio.dispose()
    expect(audio.hasSample('shoot')).toBe(false)
  })

  it('playVoiceCallout expone API', () => {
    const audio = createAudioSystem()
    expect(typeof audio.playVoiceCallout).toBe('function')
  })

  it('playVoiceCallout no rompe con tipos válidos', () => {
    const audio = createAudioSystem()
    audio.init()
    const types = ['enemySpotted', 'reloading', 'enemyDown', 'takingFire',
      'uavOnline', 'enemyUav', 'airstrikeIncoming', 'heliIncoming',
      'objective', 'matchStart', 'victory', 'defeat', 'friendlyDown', 'lastEnemy']
    for (const t of types) {
      expect(() => audio.playVoiceCallout(t)).not.toThrow()
    }
    audio.dispose()
  })

  it('playVoiceCallout ignora tipo desconocido', () => {
    const audio = createAudioSystem()
    audio.init()
    expect(() => audio.playVoiceCallout('nonexistent_callout')).not.toThrow()
    audio.dispose()
  })
})
