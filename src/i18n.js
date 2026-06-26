/* =========================================================================
   i18n — internacionalización (Fase 1.9).
   --------------------------------------------------------------------------
   Diccionario es/en. El idioma se detecta de navigator.language y se
   puede cambiar desde settings. Función t(key) devuelve el string.
   ========================================================================= */

const STRINGS = {
  es: {
    'menu.title': 'Modern Warfare',
    'menu.subtitle': 'React Edition',
    'menu.play': 'Jugar',
    'menu.loadout': 'Create-a-Class',
    'menu.settings': 'Settings',
    'menu.pause': 'Pausa',
    'menu.resume': 'Continuar',
    'menu.quit': 'Salir al menú',
    'menu.gameover': 'Misión fallida',
    'menu.gameover.subtitle': 'HAS CAÍDO EN COMBATE',
    'menu.gameover.score': 'Puntuación final',
    'menu.gameover.wave': 'Oleada alcanzada',
    'menu.gameover.retry': 'Reintentar',
    'menu.loading': 'CARGANDO MOTORES...',
    'menu.killcam': 'KILLCAM',
    'menu.back': 'Volver',

    'hud.health': 'Vida',
    'hud.ammo': 'Arma',
    'hud.wave': 'Oleada',
    'hud.enemies': 'Enemigos',
    'hud.score': 'Puntuación',
    'hud.reloading': 'Recargando...',
    'hud.streak': 'Streak',

    'settings.title': 'Settings',
    'settings.fov': 'FOV',
    'settings.sensX': 'Sensibilidad X',
    'settings.sensY': 'Sensibilidad Y',
    'settings.masterVolume': 'Volumen master',
    'settings.quality': 'Calidad gráfica',
    'settings.colorblind': 'Colorblind',
    'settings.aimAssist': 'Aim assist',
    'settings.showFps': 'Mostrar FPS',
    'settings.quality.auto': 'Auto',
    'settings.quality.low': 'Baja',
    'settings.quality.medium': 'Media',
    'settings.quality.high': 'Alta',
    'settings.colorblind.off': 'Off',

    'loadout.title': 'Create-a-Class',
    'loadout.primary': 'Arma principal',
    'loadout.secondary': 'Arma secundaria',
    'loadout.attachments': 'Attachments',
    'loadout.perks': 'Perks'
  },
  en: {
    'menu.title': 'Modern Warfare',
    'menu.subtitle': 'React Edition',
    'menu.play': 'Play',
    'menu.loadout': 'Create-a-Class',
    'menu.settings': 'Settings',
    'menu.pause': 'Pause',
    'menu.resume': 'Resume',
    'menu.quit': 'Quit to menu',
    'menu.gameover': 'Mission failed',
    'menu.gameover.subtitle': 'YOU FELL IN COMBAT',
    'menu.gameover.score': 'Final score',
    'menu.gameover.wave': 'Wave reached',
    'menu.gameover.retry': 'Retry',
    'menu.loading': 'LOADING ENGINES...',
    'menu.killcam': 'KILLCAM',
    'menu.back': 'Back',

    'hud.health': 'Health',
    'hud.ammo': 'Weapon',
    'hud.wave': 'Wave',
    'hud.enemies': 'Enemies',
    'hud.score': 'Score',
    'hud.reloading': 'Reloading...',
    'hud.streak': 'Streak',

    'settings.title': 'Settings',
    'settings.fov': 'FOV',
    'settings.sensX': 'Sensitivity X',
    'settings.sensY': 'Sensitivity Y',
    'settings.masterVolume': 'Master volume',
    'settings.quality': 'Graphics quality',
    'settings.colorblind': 'Colorblind',
    'settings.aimAssist': 'Aim assist',
    'settings.showFps': 'Show FPS',
    'settings.quality.auto': 'Auto',
    'settings.quality.low': 'Low',
    'settings.quality.medium': 'Medium',
    'settings.quality.high': 'High',
    'settings.colorblind.off': 'Off',

    'loadout.title': 'Create-a-Class',
    'loadout.primary': 'Primary weapon',
    'loadout.secondary': 'Secondary weapon',
    'loadout.attachments': 'Attachments',
    'loadout.perks': 'Perks'
  }
}

let _lang = null

export function getLang() {
  if (_lang) return _lang
  try {
    const nav = navigator.language || 'es'
    _lang = nav.startsWith('en') ? 'en' : 'es'
  } catch (e) { _lang = 'es' }
  return _lang
}

export function setLang(lang) {
  if (STRINGS[lang]) _lang = lang
}

export function t(key) {
  const lang = getLang()
  const dict = STRINGS[lang] || STRINGS.es
  return dict[key] || STRINGS.es[key] || key
}
