import type { Theme } from './theme.types'

/**
 * DEVELOPER THEME CONFIGURATION
 * -----------------------------
 * Centralized theme configuration for the entire Visa Autofill extension.
 *
 * Developers can manually edit the hex color values below to change the global theme.
 * All primary buttons, secondary buttons, background gradients, borders, and text colors
 * across the application will automatically update to reflect changes made here.
 *
 * Examples:
 * - Change primary from "#4F46E5" to "#16A34A" to make primary buttons green extension-wide.
 * - Change secondary from "#0EA5E9" to "#D97706" to change secondary button branding.
 * - Change backgroundStart/backgroundMiddle/backgroundEnd to customize the global background gradient.
 */
export const defaultTheme: Theme = {
  primary: '#4F46E5', // Primary button & primary brand action color
  secondary: '#0EA5E9', // Secondary button color

  backgroundStart: '#E0F2FE', // Global background gradient start color
  backgroundMiddle: '#F8FAFC', // Global background gradient middle color
  backgroundEnd: '#EEF2FF', // Global background gradient end color

  text: '#111827', // Main text color
  mutedText: '#64748B', // Secondary & muted text color

  border: '#CBD5E1', // Container border color
  accent: '#6366F1', // Accent & highlight color
  surface: '#FFFFFF', // Container & card background surface
}
