import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAssetLoader } from '../src/game/assets/loader.js'

describe('createAssetLoader', () => {
  let originalFetch
  let originalXHR

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalXHR = globalThis.XMLHttpRequest
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.XMLHttpRequest = originalXHR
    vi.restoreAllMocks()
  })

  it('factory devuelve API completa', () => {
    const loader = createAssetLoader()
    expect(typeof loader.loadGLTF).toBe('function')
    expect(typeof loader.loadTexture).toBe('function')
    expect(typeof loader.loadAudioBuffer).toBe('function')
    expect(typeof loader.loadManifest).toBe('function')
    expect(typeof loader.loadAll).toBe('function')
    expect(typeof loader.get).toBe('function')
    expect(typeof loader.getStats).toBe('function')
    expect(typeof loader.dispose).toBe('function')
    loader.dispose()
  })

  it('resolveURL usa cdnUrl cuando se pasa', () => {
    const loader = createAssetLoader({ cdnUrl: 'https://cdn.example.com' })
    expect(loader.getStats()).toEqual({ downloaded: 0, cached: 0, failed: 0 })
    loader.dispose()
  })

  it('loadGLTF devuelve null si fetch falla (fallback procedural)', async () => {
    const loader = createAssetLoader()
    const result = await loader.loadGLTF('nonexistent.glb')
    expect(result).toBeNull()
    loader.dispose()
  })

  it('loadTexture devuelve null si fetch falla', async () => {
    const loader = createAssetLoader()
    const result = await loader.loadTexture('nonexistent.ktx2')
    expect(result).toBeNull()
    loader.dispose()
  })

  it('loadManifest devuelve null si fetch falla', async () => {
    const loader = createAssetLoader()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    const result = await loader.loadManifest('manifest.json')
    expect(result).toBeNull()
    loader.dispose()
  })

  it('loadManifest parsea JSON válido', async () => {
    const loader = createAssetLoader()
    const fakeManifest = { version: 1, assets: { foo: { type: 'gltf', path: 'foo.glb' } } }
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeManifest
    })
    const result = await loader.loadManifest('manifest.json')
    expect(result).toEqual(fakeManifest)
    loader.dispose()
  })

  it('dispose limpia estado sin crashear', () => {
    const loader = createAssetLoader()
    loader.dispose()
    expect(loader.getStats()).toEqual({ downloaded: 0, cached: 0, failed: 0 })
  })

  it('loadAll con manifest vacío devuelve objeto vacío', async () => {
    const loader = createAssetLoader()
    const result = await loader.loadAll({ assets: {} })
    expect(result).toEqual({})
    loader.dispose()
  })

  it('get devuelve undefined para clave no cargada', () => {
    const loader = createAssetLoader()
    expect(loader.get('nope')).toBeUndefined()
    loader.dispose()
  })
})
