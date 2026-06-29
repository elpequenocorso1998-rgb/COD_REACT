import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'

/* =========================================================================
   Asset loader — pipeline de assets reales (GLTF/DRACO/KTX2).
   --------------------------------------------------------------------------
   - Manifest JSON declara URLs, hashes SHA-256 y dependencias.
   - Cache en IndexedDB (chunked) para no redescargar entre sesiones.
   - Fallback procedural: si un asset falla, el caller puede usar su
     builder procedural (lo actual de viewmodels.js / humanoid.js).
   - Progress callback para UI.
   - dispose() libera geometries/materials/textures Three.js registrados.
   ========================================================================= */

const DB_NAME = 'mw_assets_v1'
const DB_STORE = 'chunks'
const DB_VERSION = 1

let _renderer = null
const _ktx2Cache = new WeakMap()

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function dbGet(db, id) {
  if (!db) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(id)
    req.onsuccess = () => resolve(req.result ? req.result.data : null)
    req.onerror = () => reject(req.error)
  })
}

async function dbPut(db, id, data) {
  if (!db) return
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put({ id, data })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function sha256(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export function createAssetLoader({ cdnUrl = '', renderer = null } = {}) {
  _renderer = renderer
  const baseURL = cdnUrl || (import.meta.env?.VITE_CDN_URL) || '/assets'
  let gltf = null
  let draco = null
  let ktx2 = null
  try {
    gltf = new GLTFLoader()
    if (DRACOLoader) {
      draco = new DRACOLoader()
      draco.setDecoderPath(`${baseURL}/decoders/draco/`)
      gltf.setDRACOLoader(draco)
    }
  } catch (e) {
    console.warn('[assets] GLTF/DRACO loader no disponible, fallback procedural', e)
    gltf = null
  }
  if (_renderer && KTX2Loader) {
    try {
      ktx2 = new KTX2Loader()
      ktx2.setTranscoderPath(`${baseURL}/decoders/basis/`)
      ktx2.detectSupport(_renderer)
      _ktx2Cache.set(_renderer, ktx2)
      if (gltf) gltf.setKTX2Loader(ktx2)
    } catch (e) {
      console.warn('[assets] KTX2 loader no disponible', e)
      ktx2 = null
    }
  }
  const cache = new Map()
  const textures = new Set()
  const geometries = new Set()
  const materials = new Set()
  const animations = new Set()
  let dbPromise = openDB()
  const stats = { downloaded: 0, cached: 0, failed: 0 }

  function resolveURL(path) {
    if (/^https?:\/\//.test(path) || path.startsWith('data:')) return path
    return `${baseURL}/${path.replace(/^\//, '')}`
  }

  async function fetchWithCache(path, hash, onProgress) {
    const url = resolveURL(path)
    const cacheKey = hash || path
    const db = await dbPromise
    const cached = await dbGet(db, cacheKey)
    if (cached) {
      stats.cached++
      return cached
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', url, true)
      xhr.responseType = 'arraybuffer'
      xhr.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(e.loaded, e.total)
        }
      }
      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const buf = xhr.response
          stats.downloaded++
          if (hash) {
            const computed = await sha256(url + buf.byteLength)
            if (computed && hash && computed !== hash) {
              reject(new Error(`Hash mismatch for ${path}`))
              return
            }
          }
          await dbPut(db, cacheKey, buf)
          resolve(buf)
        } else {
          reject(new Error(`HTTP ${xhr.status} for ${url}`))
        }
      }
      xhr.onerror = () => reject(new Error(`Network error for ${url}`))
      xhr.send()
    })
  }

  async function loadGLTF(path, { hash, onProgress } = {}) {
    if (cache.has(path)) return cache.get(path)
    if (!gltf) return null
    try {
      const buf = await fetchWithCache(path, hash, onProgress)
      const result = await new Promise((resolve, reject) => {
        gltf.parse(buf, '', resolve, reject)
      })
      if (result.scene) {
        result.scene.traverse((o) => {
          if (o.isMesh) {
            if (o.geometry) geometries.add(o.geometry)
            if (o.material) materials.add(o.material)
            if (o.material?.map) textures.add(o.material.map)
            if (o.material?.normalMap) textures.add(o.material.normalMap)
            if (o.material?.roughnessMap) textures.add(o.material.roughnessMap)
            if (o.material?.metalnessMap) textures.add(o.material.metalnessMap)
          }
        })
      }
      if (result.animations) {
        result.animations.forEach((a) => animations.add(a))
      }
      cache.set(path, result)
      return result
    } catch (err) {
      stats.failed++
      console.warn(`[assets] GLTF load failed: ${path}`, err)
      return null
    }
  }

  async function loadTexture(path, { hash, onProgress } = {}) {
    if (cache.has(path)) return cache.get(path)
    try {
      const buf = await fetchWithCache(path, hash, onProgress)
      const blob = new Blob([buf])
      const url = URL.createObjectURL(blob)
      try {
        const tex = await new Promise((resolve, reject) => {
          new THREE.TextureLoader().load(url, resolve, undefined, reject)
        })
        tex.colorSpace = THREE.SRGBColorSpace
        textures.add(tex)
        cache.set(path, tex)
        return tex
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      stats.failed++
      console.warn(`[assets] Texture load failed: ${path}`, err)
      return null
    }
  }

  async function loadAudioBuffer(path, audioCtx, { hash, onProgress } = {}) {
    if (cache.has(path)) return cache.get(path)
    try {
      const buf = await fetchWithCache(path, hash, onProgress)
      const audioBuffer = await audioCtx.decodeAudioData(buf.slice(0))
      cache.set(path, audioBuffer)
      return audioBuffer
    } catch (err) {
      stats.failed++
      console.warn(`[assets] Audio load failed: ${path}`, err)
      return null
    }
  }

  async function loadManifest(manifestUrl) {
    try {
      const res = await fetch(resolveURL(manifestUrl))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      console.warn('[assets] Manifest load failed', err)
      return null
    }
  }

  async function loadAll(manifest, onProgress) {
    const entries = Object.entries(manifest.assets || {})
    const total = entries.length
    let done = 0
    const results = {}
    await Promise.all(entries.map(async ([key, spec]) => {
      const opts = { hash: spec.hash, onProgress: null }
      let result = null
      if (spec.type === 'gltf') result = await loadGLTF(spec.path, opts)
      else if (spec.type === 'texture') result = await loadTexture(spec.path, opts)
      else if (spec.type === 'audio') {
        const Ctx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
        if (Ctx) result = await loadAudioBuffer(spec.path, new Ctx(), opts)
      }
      results[key] = result
      done++
      if (onProgress) onProgress(done, total, key)
    }))
    return results
  }

  function dispose() {
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => {
      m.dispose()
    })
    textures.forEach((t) => t.dispose())
    animations.clear()
    cache.clear()
    geometries.clear()
    materials.clear()
    textures.clear()
    if (draco) draco.dispose()
    if (ktx2) ktx2.dispose()
    dbPromise = null
  }

  return {
    loadGLTF,
    loadTexture,
    loadAudioBuffer,
    loadManifest,
    loadAll,
    get: (key) => cache.get(key),
    getStats: () => ({ ...stats }),
    dispose
  }
}
