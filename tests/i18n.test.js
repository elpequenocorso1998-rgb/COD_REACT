import { describe, it, expect, beforeEach } from 'vitest'
import { t, getLang, setLang } from '../src/i18n.js'

describe('i18n', () => {
  beforeEach(() => {
    setLang('es')
  })

  it('devuelve strings en español por defecto', () => {
    expect(t('menu.play')).toBe('Jugar')
    expect(t('menu.settings')).toBe('Settings')
    expect(t('menu.gameover')).toBe('Misión fallida')
  })

  it('cambia a inglés con setLang', () => {
    setLang('en')
    expect(t('menu.play')).toBe('Play')
    expect(t('menu.gameover')).toBe('Mission failed')
    expect(t('menu.gameover.subtitle')).toBe('YOU FELL IN COMBAT')
  })

  it('devuelve la key si no existe la traducción', () => {
    expect(t('no.existe')).toBe('no.existe')
  })

  it('getLang devuelve es o en', () => {
    setLang('en')
    expect(getLang()).toBe('en')
    setLang('es')
    expect(getLang()).toBe('es')
  })

  it('fallback a es si lang no soportado', () => {
    setLang('fr')
    expect(getLang()).toBe('es')
    expect(t('menu.play')).toBe('Jugar')
  })
})
