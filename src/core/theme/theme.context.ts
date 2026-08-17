import { createContext } from 'react'
import type { Theme, ThemeContextType } from './theme.types'

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function applyThemeToCssVariables(theme: Theme): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-secondary', theme.secondary)
  root.style.setProperty('--color-bg-start', theme.backgroundStart)
  root.style.setProperty('--color-bg-middle', theme.backgroundMiddle)
  root.style.setProperty('--color-bg-end', theme.backgroundEnd)
  root.style.setProperty('--color-text', theme.text)
  root.style.setProperty('--color-muted', theme.mutedText)
  root.style.setProperty('--color-border', theme.border)
  root.style.setProperty('--color-accent', theme.accent)
  root.style.setProperty('--color-surface', theme.surface)
}
