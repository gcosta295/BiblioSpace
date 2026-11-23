import { useState, useSyncExternalStore } from 'react'

const storageKey = 'bibliospace-theme'
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const root = document.documentElement

try {
  const savedTheme = localStorage.getItem(storageKey)
  if (savedTheme === 'dark' || savedTheme === 'light') root.dataset.theme = savedTheme
} catch {
  // The system preference remains available when storage is blocked.
}

function subscribeToSystemTheme(onChange) {
  systemTheme.addEventListener('change', onChange)
  return () => systemTheme.removeEventListener('change', onChange)
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(root.dataset.theme)
  const systemDark = useSyncExternalStore(subscribeToSystemTheme, () => systemTheme.matches)
  const dark = theme ? theme === 'dark' : systemDark

  function toggleTheme() {
    const nextTheme = dark ? 'light' : 'dark'
    root.dataset.theme = nextTheme
    setTheme(nextTheme)

    try {
      localStorage.setItem(storageKey, nextTheme)
    } catch {
      // Keep the current selection for the life of this page.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Modo oscuro"
      aria-pressed={dark}
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      onClick={toggleTheme}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <path d="M20.8 15.4A9.2 9.2 0 0 1 8.6 3.2a9.2 9.2 0 1 0 12.2 12.2Z" />
        )}
      </svg>
    </button>
  )
}
