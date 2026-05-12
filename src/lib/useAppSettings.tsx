import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Lang } from './i18n'

export type Theme = 'light' | 'dark' | 'blue' | 'forest'

export type AppSettings = { lang: Lang; theme: Theme; masterPasswordEnabled: boolean }

const DEFAULT: AppSettings = { lang: 'ja', theme: 'light', masterPasswordEnabled: false }
export const SETTINGS_STORAGE_KEY = 'app_settings'

async function loadSettings(): Promise<AppSettings> {
  const r = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
  return { ...DEFAULT, ...(r[SETTINGS_STORAGE_KEY] ?? {}) }
}

type Ctx = { settings: AppSettings; update: (patch: Partial<AppSettings>) => void }
const Context = createContext<Ctx>({ settings: DEFAULT, update: () => {} })

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT)
  useEffect(() => { loadSettings().then(setSettings) }, [])
  const update = (patch: Partial<AppSettings>) =>
    setSettings(prev => {
      const next = { ...prev, ...patch }
      chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: next })
      return next
    })
  return <Context.Provider value={{ settings, update }}>{children}</Context.Provider>
}

export function useAppSettings() { return useContext(Context) }

// CSS custom property sets for each theme
type CSSVars = Record<string, string>

export const THEME_VARS: Record<Theme, CSSVars> = {
  light: {
    '--bg': '#ffffff', '--bg-sub': '#f9f9f9', '--bg-group': '#f5f5f5',
    '--text': '#111111', '--text-sub': '#444444', '--text-muted': '#888888',
    '--border': '#eeeeee', '--border-light': '#f0f0f0',
    '--primary': '#0070d2', '--primary-fg': '#ffffff', '--primary-light': '#e8f0fe',
    '--danger': '#c0392b', '--danger-bg': '#fdf0ef', '--danger-border': '#f5c6c1',
    '--success': '#27ae60',
    '--input-border': '#dddddd', '--input-bg': '#ffffff',
    '--btn-sec-bg': '#f5f5f5', '--btn-sec-border': '#cccccc',
    '--icon': '#666666', '--drag-handle': '#cccccc',
  },
  dark: {
    '--bg': '#1e1e2e', '--bg-sub': '#181825', '--bg-group': '#313244',
    '--text': '#cdd6f4', '--text-sub': '#bac2de', '--text-muted': '#6c7086',
    '--border': '#45475a', '--border-light': '#313244',
    '--primary': '#89b4fa', '--primary-fg': '#1e1e2e', '--primary-light': '#2a3555',
    '--danger': '#f38ba8', '--danger-bg': '#2d1f27', '--danger-border': '#4a2535',
    '--success': '#a6e3a1',
    '--input-border': '#45475a', '--input-bg': '#313244',
    '--btn-sec-bg': '#313244', '--btn-sec-border': '#45475a',
    '--icon': '#bac2de', '--drag-handle': '#45475a',
  },
  blue: {
    '--bg': '#0d1117', '--bg-sub': '#161b22', '--bg-group': '#21262d',
    '--text': '#e6edf3', '--text-sub': '#c9d1d9', '--text-muted': '#8b949e',
    '--border': '#30363d', '--border-light': '#21262d',
    '--primary': '#58a6ff', '--primary-fg': '#0d1117', '--primary-light': '#1a2d4a',
    '--danger': '#ff7b72', '--danger-bg': '#1a1215', '--danger-border': '#3d1f22',
    '--success': '#3fb950',
    '--input-border': '#30363d', '--input-bg': '#161b22',
    '--btn-sec-bg': '#21262d', '--btn-sec-border': '#30363d',
    '--icon': '#8b949e', '--drag-handle': '#30363d',
  },
  forest: {
    '--bg': '#faf6ef', '--bg-sub': '#f3ede0', '--bg-group': '#e8e0ce',
    '--text': '#2c2415', '--text-sub': '#4a3c28', '--text-muted': '#8c7a5a',
    '--border': '#d4c9a0', '--border-light': '#e0d8c4',
    '--primary': '#4a7c3f', '--primary-fg': '#ffffff', '--primary-light': '#dbecd8',
    '--danger': '#a03020', '--danger-bg': '#fdf0ef', '--danger-border': '#f5c6c1',
    '--success': '#4a7c3f',
    '--input-border': '#c8bda0', '--input-bg': '#fefdf8',
    '--btn-sec-bg': '#e8e0ce', '--btn-sec-border': '#c8bda0',
    '--icon': '#6a5a40', '--drag-handle': '#b8a880',
  },
}
