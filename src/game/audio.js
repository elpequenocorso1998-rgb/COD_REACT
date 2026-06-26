/* =========================================================================
   Sistema de audio procedural (Web Audio API).
   --------------------------------------------------------------------------
   Generamos TODOS los sonidos sintéticamente: no necesitamos ficheros.
   - Disparos: ruido blanco filtrado + click del percutor + cola de eco.
   - Recarga: clicks metálicos sintetizados.
   - Impactos en carne: thud grave.
   - Impactos en pared: tint metálico.
   - Daño recibido: tono grave descendente.
   - Ambient: drone bajo + viento (loop continuo).
   ========================================================================= */
export function createAudioSystem() {
  let ctx = null
  let masterGain = null
  let ambientNodes = []
  let started = false
  let muted = false
  // Buffer de ruido blanco pre-creado: lo reutilizamos en cada disparo para
  // no allocar ~13k samples por cada shot (cada 100ms en ráfaga).
  let noiseBuffer = null
  // Delay node reutilizable para el eco de los disparos.
  let shootDelay = null
  let shootFeedback = null

  // Inicialización perezosa: el AudioContext solo puede crearse tras
  // interacción del usuario (política de autostart de los navegadores).
  function init() {
    if (started) return
    started = true
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      ctx = new Ctx()
      masterGain = ctx.createGain()
      masterGain.gain.value = muted ? 0 : 0.5
      masterGain.connect(ctx.destination)

      // Algunos navegadores (Chrome con autoplay estricto) crean el ctx
      // en estado 'suspended' incluso tras gesto de usuario. Forzamos
      // resume para que el audio realmente funcione.
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {})
      }

      // Pre-creamos el buffer de ruido blanco (0.3s) una sola vez.
      const bufferSize = Math.floor(ctx.sampleRate * 0.3)
      noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

      // Delay reutilizable para el eco de los disparos.
      shootDelay = ctx.createDelay(1.0)
      shootDelay.delayTime.value = 0.08
      shootFeedback = ctx.createGain()
      shootFeedback.gain.value = 0.3
      shootDelay.connect(shootFeedback).connect(shootDelay)
      shootDelay.connect(masterGain)

      startAmbient()
    } catch (e) {
      console.warn('Audio no disponible:', e)
    }
  }

  // Helper: comprueba si el ctx está vivo antes de usarlo.
  function alive() {
    return ctx && ctx.state !== 'closed'
  }

  // --- Sonido de disparo ---
  // Combinación de:
  // 1. Click del percutor (tono corto y agudo).
  // 2. Estampido (ruido blanco filtrado con decaimiento rápido).
  // 3. Eco (delay con feedback reutilizable).
  function playShoot() {
    if (!alive()) return
    const t = ctx.currentTime

    // 1. Click del percutor: oscilador cuadrado corto.
    const click = ctx.createOscillator()
    const clickGain = ctx.createGain()
    click.type = 'square'
    click.frequency.value = 1200
    clickGain.gain.setValueAtTime(0.3, t)
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.01)
    click.connect(clickGain).connect(masterGain)
    click.start(t)
    click.onended = () => { click.disconnect(); clickGain.disconnect() }
    click.stop(t + 0.02)

    // 2. Estampido: ruido blanco con filtro paso-bajo que se cierra.
    // Reutilizamos el buffer pre-creado en lugar de generar uno nuevo.
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.setValueAtTime(3000, t)
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.2)
    noiseFilter.Q.value = 1
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(0.7, t)
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    noise.connect(noiseFilter).connect(noiseGain).connect(masterGain)
    // Eco: conectamos al delay reutilizable.
    noiseGain.connect(shootDelay)
    noise.start(t)
    noise.onended = () => {
      noise.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect()
    }

    // 3. El eco lo gestiona shootDelay (conectado a masterGain).
  }

  // --- Sonido de recarga ---
  // Dos clicks metálicos separados ~0.5s.
  function playReload() {
    if (!alive()) return
    const t = ctx.currentTime
    metalClick(t, 0.4)
    metalClick(t + 0.4, 0.5)
    metalClick(t + 1.0, 0.3)
  }

  function metalClick(t, vol = 0.4) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(800, t)
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.03)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.05)
  }

  // --- Impacto en carne ---
  function playHitFlesh() {
    if (!alive()) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1)
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.13)
  }

  // --- Impacto en pared ---
  function playHitWall() {
    if (!alive()) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(2500, t)
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.05)
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.09)
  }

  // --- Daño recibido ---
  function playDamage() {
    if (!alive()) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.3)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.36)
  }

  // --- Muerte de enemigo ---
  function playKill() {
    if (!alive()) return
    const t = ctx.currentTime
    // Tono ascendente de "logro".
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.15)
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.21)
  }

  // --- Sonido ambiental continuo ---
  // Drone bajo + viento (ruido filtrado) en loop.
  function startAmbient() {
    if (!alive()) return
    // Drone: dos osciladores graves ligeramente detuned.
    for (const freq of [55, 55.5, 110]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.value = 0.05
      osc.connect(gain).connect(masterGain)
      osc.start()
      ambientNodes.push(osc, gain)
    }
    // Viento: ruido blanco filtrado con paso-bajo y LFO en la cutoff.
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    noise.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 400
    filter.Q.value = 0.5
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.1
    lfoGain.gain.value = 200
    lfo.connect(lfoGain).connect(filter.frequency)
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.04
    noise.connect(filter).connect(noiseGain).connect(masterGain)
    noise.start(); lfo.start()
    ambientNodes.push(noise, filter, lfo, lfoGain, noiseGain)
  }

  // --- Hitmarker sonoro (4 variantes según tipo de impacto) ---
  // type: 'body' | 'headshot' | 'kill' | 'wallbang'
  function playHitMarker(type = 'body') {
    if (!alive()) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    // Frecuencia distinta por tipo: body=800, headshot=1200, kill=600→1000 chime, wallbang=400.
    const freq = type === 'headshot' ? 1200 : type === 'kill' ? 600 : type === 'wallbang' ? 400 : 800
    osc.frequency.setValueAtTime(freq, t)
    if (type === 'kill') {
      osc.frequency.exponentialRampToValueAtTime(1000, t + 0.08)
    }
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.07)
  }

  // --- Callout de multikill (tono ascendente según nivel) ---
  function playCallout(label) {
    if (!alive()) return
    const t = ctx.currentTime
    // Frecuencia base según el nivel de combo (más alto = más agudo).
    const level = label.includes('MONSTER') ? 5 : label.includes('MEGA') ? 4
      : label.includes('MULTI') ? 3 : label.includes('TRIPLE') ? 2 : 1
    const baseFreq = 400 + level * 100
    // Dos tonos ascendentes.
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(baseFreq + i * 200, t + i * 0.1)
      gain.gain.setValueAtTime(0.2, t + i * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.15)
      osc.connect(gain).connect(masterGain)
      osc.start(t + i * 0.1)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
      osc.stop(t + i * 0.1 + 0.16)
    }
  }

  // --- Sonidos de killstreaks ---
  function playAirstrike() {
    if (!alive()) return
    // Silbido descendente + explosión.
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(2000, t)
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.5)
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 0.7)
  }

  function playExplosion() {
    if (!alive()) return
    const t = ctx.currentTime
    // Ruido con decaimiento rápido + tono grave.
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(800, t)
    filter.frequency.exponentialRampToValueAtTime(50, t + 0.4)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.5, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
    noise.connect(filter).connect(gain).connect(masterGain)
    noise.start(t)
    noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect() }
  }

  function playHeliIncoming() {
    if (!alive()) return
    // Tono grave modulado (rotor lejano).
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = 80
    lfo.frequency.value = 8 // rotor blade chop
    lfoGain.gain.value = 20
    lfo.connect(lfoGain).connect(osc.frequency)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5)
    osc.connect(gain).connect(masterGain)
    osc.start(t); lfo.start(t)
    osc.onended = () => { osc.disconnect(); lfo.disconnect(); lfoGain.disconnect(); gain.disconnect() }
    osc.stop(t + 1.6); lfo.stop(t + 1.6)
  }

  function playHeliShoot() {
    if (!alive()) return
    // Ráfaga corta (ametralladora desde el aire).
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = 300
      gain.gain.setValueAtTime(0.1, t + i * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.03)
      osc.connect(gain).connect(masterGain)
      osc.start(t + i * 0.08)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
      osc.stop(t + i * 0.08 + 0.04)
    }
  }

  function playGunshipIncoming() {
    if (!alive()) return
    // Tono grave continuo (motor de jet).
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.linearRampToValueAtTime(60, t + 2)
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2)
    osc.connect(gain).connect(masterGain)
    osc.start(t)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(t + 2.1)
  }

  // --- Level up (progresión) ---
  function playLevelUp() {
    if (!alive()) return
    const t = ctx.currentTime
    // Arpegio ascendente C-E-G-C.
    const notes = [523, 659, 784, 1047]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = notes[i]
      gain.gain.setValueAtTime(0.2, t + i * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.2)
      osc.connect(gain).connect(masterGain)
      osc.start(t + i * 0.1)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
      osc.stop(t + i * 0.1 + 0.25)
    }
  }

  // --- Disparo enemigo (más apagado y grave que el del jugador) ---
  // Con audio 3D posicional: el sonido viene de la dirección del enemigo.
  function playEnemyShoot(enemyPos, playerPos) {
    if (!alive()) return
    const t = ctx.currentTime
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1500, t)
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.15)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.25, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)

    // PannerNode para audio 3D posicional (si tenemos posiciones).
    if (enemyPos && playerPos) {
      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'exponential'
      panner.refDistance = 1
      panner.maxDistance = 100
      panner.rolloffFactor = 2
      // Posición del enemigo relativa al listener (que está en el origen).
      panner.positionX.value = enemyPos.x - playerPos.x
      panner.positionY.value = (enemyPos.y || 1.4) - playerPos.y
      panner.positionZ.value = enemyPos.z - playerPos.z
      noise.connect(filter).connect(gain).connect(panner).connect(masterGain)
      noise.start(t)
      noise.onended = () => {
        noise.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect()
      }
    } else {
      noise.connect(filter).connect(gain).connect(masterGain)
      noise.start(t)
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect() }
    }
  }

  // --- Pasos del jugador (según material del suelo) ---
  let lastFootstepAt = 0
  function playFootstep(speed, material = 'stone') {
    if (!alive()) return
    const now = ctx.currentTime
    if (now - lastFootstepAt < 0.3) return // throttle
    lastFootstepAt = now
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    // Frecuencia según material: stone=180, wood=140, metal=250.
    const freq = material === 'metal' ? 250 : material === 'wood' ? 140 : 180
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.05)
    const vol = Math.min(0.15, speed * 0.02)
    gain.gain.setValueAtTime(vol, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.connect(gain).connect(masterGain)
    osc.start(now)
    osc.onended = () => { osc.disconnect(); gain.disconnect() }
    osc.stop(now + 0.07)
  }

  // --- Música dinámica ---
  // Capas que entran según intensidad: drone base (calma), percusión
  // (combate), stingers ascendentes (clímax).
  let musicNodes = []
  let musicGain = null

  function startMusic() {
    if (!alive() || musicGain) return
    musicGain = ctx.createGain()
    musicGain.gain.value = 0.08
    musicGain.connect(masterGain)
    // Drone base: siempre presente.
    for (const freq of [55, 82.5]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.value = 0.5
      osc.connect(gain).connect(musicGain)
      osc.start()
      musicNodes.push(osc, gain)
    }
    // Percusión (solo audible en combate): tono grave rítmico.
    const perc = ctx.createOscillator()
    const percGain = ctx.createGain()
    perc.type = 'sawtooth'
    perc.frequency.value = 40
    percGain.gain.value = 0 // empieza silencioso
    perc.connect(percGain).connect(musicGain)
    perc.start()
    musicNodes.push(perc, percGain)
    // Lo guardamos para mutear/desmutear según intensidad.
    _percGain = percGain
  }

  let _percGain = null
  // Ajusta la intensidad musical según el estado del juego.
  // intensity: 0=calma, 1=combate, 2=clímax (muerte cercana, oleada alta).
  function setMusicIntensity(intensity) {
    if (!alive() || !_percGain) return
    const t = ctx.currentTime
    const target = intensity >= 1 ? 0.3 : 0.0
    _percGain.gain.cancelScheduledValues(t)
    _percGain.gain.setValueAtTime(_percGain.gain.value, t)
    _percGain.gain.linearRampToValueAtTime(target, t + 1.0)
  }

  function stopMusic() {
    for (const n of musicNodes) { try { n.stop && n.stop(); n.disconnect() } catch (e) {} }
    musicNodes = []
    if (musicGain) { try { musicGain.disconnect() } catch (e) {} }
    musicGain = null
    _percGain = null
  }

  // Pausa el ambiente (cuando el juego está pausado) con rampa suave (sin clicks).
  function setMuted(m) {
    muted = m
    if (!masterGain || !alive()) return
    // Si estamos desmutando y el ctx está suspended, lo reanudamos
    // (puede haberse suspendido tras backgrounding de la pestaña).
    if (!m && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {})
    }
    const target = m ? 0 : 0.5
    masterGain.gain.cancelScheduledValues(ctx.currentTime)
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime)
    masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05)
  }

  function dispose() {
    stopMusic()
    ambientNodes.forEach(n => { try { n.stop && n.stop(); n.disconnect() } catch (e) {} })
    ambientNodes = []
    if (shootDelay) { try { shootDelay.disconnect() } catch (e) {}  shootDelay = null }
    if (shootFeedback) { try { shootFeedback.disconnect() } catch (e) {}  shootFeedback = null }
    if (ctx) {
      try { ctx.close() } catch (e) {}
      ctx = null
      masterGain = null
    }
    started = false
  }

  return {
    init, playShoot, playReload, playHitFlesh, playHitWall,
    playDamage, playKill, setMuted, dispose,
    playHitMarker, playCallout,
    playAirstrike, playExplosion, playHeliIncoming, playHeliShoot, playGunshipIncoming,
    playLevelUp, playEnemyShoot, playFootstep,
    startMusic, stopMusic, setMusicIntensity
  }
}
