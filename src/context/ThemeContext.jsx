import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark') // 'dark' | 'light'
  const [particlesEnabled, setParticlesEnabled] = useState(true)

  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const toggleParticles = () => setParticlesEnabled(p => !p)

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, particlesEnabled, toggleParticles }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
