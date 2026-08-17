export interface Theme {
  primary: string
  secondary: string
  backgroundStart: string
  backgroundMiddle: string
  backgroundEnd: string
  text: string
  mutedText: string
  border: string
  accent: string
  surface: string
}

export interface ThemeContextType {
  theme: Theme
}
