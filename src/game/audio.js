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

      // Pre-creamos el buffer de ruido blanco (0.3s) una sola vez.
      const bufferSize = ctx.sampleRate * 0.3
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

  // Pausa el ambiente (cuando el juego está pausado) con rampa suave (sin clicks).
  function setMuted(m) {
    muted = m
    if (!masterGain || !alive()) return
    const target = m ? 0 : 0.5
    masterGain.gain.cancelScheduledValues(ctx.currentTime)
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime)
    masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05)
  }

  function dispose() {
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
    playDamage, playKill, setMuted, dispose
  }
}
