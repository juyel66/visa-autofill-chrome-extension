import React, { useEffect } from 'react'
import { defaultTheme } from './theme.config'
import { applyThemeToCssVariables, ThemeContext } from './theme.context'

export interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  useEffect(() => {
    applyThemeToCssVariables(defaultTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: defaultTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
